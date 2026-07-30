import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileProject } from "../compiler/compileProject";

export const fitViewSpy = vi.fn();
export const zoomInSpy = vi.fn();
export const zoomOutSpy = vi.fn();

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    useReactFlow: () => ({ fitView: fitViewSpy, zoomIn: zoomInSpy, zoomOut: zoomOutSpy }),
    useViewport: () => ({ x: 0, y: 0, zoom: 1 })
  };
});

import { DiagramCanvas } from "./DiagramCanvas";

function buildModel(source: string) {
  const compiled = compileProject(source);
  if (!compiled.model) {
    throw new Error("expected a valid model");
  }
  return compiled.model;
}

describe("DiagramCanvas insets", () => {
  beforeEach(() => {
    fitViewSpy.mockClear();
    zoomInSpy.mockClear();
    zoomOutSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to zero padding when no insets are supplied", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ top: "112px", bottom: "112px", left: "0px", right: "0px" })
      })
    );
  });

  it("adds left breathing room on top of the open editor inset", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} insets={{ left: 260, right: 220 }} />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "372px", right: "220px" })
      })
    );
  });

  it("re-fits with new padding when insets change", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { rerender } = render(<DiagramCanvas model={model} insets={{ left: 260, right: 0 }} />);
    fitViewSpy.mockClear();

    rerender(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "0px", right: "0px" })
      })
    );
  });

  it("does not re-fit on a re-render where the model and insets are unchanged", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { rerender } = render(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} />);
    fitViewSpy.mockClear();

    rerender(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} />);

    expect(fitViewSpy).not.toHaveBeenCalled();
  });

  it("re-fits when the visible layout key changes", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { rerender } = render(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} fitKey="mobile-code" />);
    fitViewSpy.mockClear();

    rerender(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} fitKey="mobile-diagram" />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "0px", right: "0px" })
      })
    );
  });

  it("schedules a post-paint re-fit when the visible layout key changes", () => {
    const model = buildModel("component API service\nnorth -> API");
    let postPaintFit: FrameRequestCallback | undefined;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      postPaintFit = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { rerender } = render(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} fitKey="mobile-code" />);
    fitViewSpy.mockClear();
    requestAnimationFrameSpy.mockClear();

    rerender(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} fitKey="mobile-diagram" />);

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(fitViewSpy).toHaveBeenCalledTimes(1);

    postPaintFit?.(0);

    expect(fitViewSpy).toHaveBeenCalledTimes(2);
  });
});

describe("DiagramCanvas component styling", () => {
  it("does not mark API components with a special color class", () => {
    const model = buildModel("component books api");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByText("books").closest(".component-node")).not.toHaveClass("component-node--api");
  });

  it("renders internal component subtype text inside the component circle", () => {
    const model = buildModel("component books api");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByText("api").closest(".component-node")).toBeInTheDocument();
  });

  it("still renders boundary dependency subtype text inside external circles", () => {
    const model = buildModel("component books\neast users api\nbooks -> users");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByText("api").closest(".external-node")).toBeInTheDocument();
  });
});

describe("DiagramCanvas live-edit motion", () => {
  it("keeps the initial graph still, then animates only a newly added circle", () => {
    const initialModel = buildModel("component API service");
    const { rerender } = render(<DiagramCanvas model={initialModel} motionContextKey="doc-1" />);

    expect(screen.getByText("API").closest(".react-flow__node")).not.toHaveClass("diagram-node--entering");

    const nextModel = buildModel("component API service\ncomponent Worker service");
    rerender(<DiagramCanvas model={nextModel} motionContextKey="doc-1" />);

    expect(screen.getByText("Worker").closest(".react-flow__node")).toHaveClass("diagram-node--entering");
    expect(screen.getByText("API").closest(".react-flow__node")).toHaveClass(
      "diagram-node--position-animated"
    );
  });

  it("updates labels quietly without replaying an entrance", () => {
    const { rerender } = render(
      <DiagramCanvas model={buildModel('component api as "Orders API" service')} motionContextKey="doc-1" />
    );

    rerender(
      <DiagramCanvas model={buildModel('component api as "Checkout API" service')} motionContextKey="doc-1" />
    );

    expect(screen.getByText("Checkout API").closest(".react-flow__node")).not.toHaveClass("diagram-node--entering");
  });

  it("updates an identifier on the same source line without replaying an entrance", () => {
    const { rerender } = render(
      <DiagramCanvas model={buildModel("component W service")} motionContextKey="doc-1" />
    );

    rerender(<DiagramCanvas model={buildModel("component Wo service")} motionContextKey="doc-1" />);

    expect(screen.getByText("Wo").closest(".react-flow__node")).not.toHaveClass("diagram-node--entering");
  });

  it("does not animate the incoming graph when the document context changes", () => {
    const { rerender } = render(
      <DiagramCanvas model={buildModel("component API service")} motionContextKey="doc-1" />
    );

    rerender(
      <DiagramCanvas
        model={buildModel("component API service\ncomponent Worker service")}
        motionContextKey="doc-2"
      />
    );

    expect(screen.getByText("Worker").closest(".react-flow__node")).not.toHaveClass("diagram-node--entering");
  });

  it("keeps a node animating through a re-render that did not change the graph", async () => {
    // API and DB are linked so that focusing API yields a non-empty connection
    // set, which is what actually re-renders the canvas.
    const initialModel = buildModel("component API service\ncomponent DB database\nAPI -> DB");
    const { rerender } = render(<DiagramCanvas model={initialModel} motionContextKey="doc-1" />);

    const apiCircle = screen.getByText("API").closest(".component-node");
    const apiNode = screen.getByText("API").closest(".react-flow__node");
    await waitFor(() => expect(apiCircle).toHaveAttribute("data-diagram-node-id", "API"));

    const nextModel = buildModel(
      "component API service\ncomponent DB database\nAPI -> DB\ncomponent Worker service"
    );
    rerender(<DiagramCanvas model={nextModel} motionContextKey="doc-1" />);
    expect(screen.getByText("Worker").closest(".react-flow__node")).toHaveClass("diagram-node--entering");

    // Focusing a component re-renders without touching the graph. Motion used to
    // be recomputed during every render against an already-updated snapshot, so
    // an unrelated re-render like this one dropped the entrance mid-animation.
    fireEvent.click(apiCircle!);
    await waitFor(() => expect(apiNode).toHaveClass("connection-highlight-node"));

    expect(screen.getByText("Worker").closest(".react-flow__node")).toHaveClass("diagram-node--entering");
  });

  it("clears the entrance once the motion has had time to settle", () => {
    vi.useFakeTimers();
    try {
      const initialModel = buildModel("component API service");
      const { rerender } = render(<DiagramCanvas model={initialModel} motionContextKey="doc-1" />);

      const nextModel = buildModel("component API service\ncomponent Worker service");
      rerender(<DiagramCanvas model={nextModel} motionContextKey="doc-1" />);
      expect(screen.getByText("Worker").closest(".react-flow__node")).toHaveClass("diagram-node--entering");

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByText("Worker").closest(".react-flow__node")).not.toHaveClass(
        "diagram-node--entering"
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DiagramCanvas zoom controls", () => {
  it("shows the current zoom level as a percentage", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("wires the zoom in, zoom out, and fit buttons to the React Flow instance", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} insets={{ left: 10, right: 20 }} />);
    fitViewSpy.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit diagram to view" }));

    expect(zoomInSpy).toHaveBeenCalledTimes(1);
    expect(zoomOutSpy).toHaveBeenCalledTimes(1);
    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "122px", right: "20px" })
      })
    );
  });

  it("no longer renders the default React Flow controls widget", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { container } = render(<DiagramCanvas model={model} />);

    expect(container.querySelector(".react-flow__controls")).not.toBeInTheDocument();
  });

  // TODO: restore this assertion when the PNG/SVG image export feature is
  // re-enabled in DiagramCanvas (ExportControls is currently commented out).
  it("does not render image export controls while the feature is disabled", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);
    expect(screen.queryByRole("button", { name: /export png/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export svg/i })).not.toBeInTheDocument();
  });

  it("disables Auto arrange until a custom layout exists", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByRole("button", { name: "Auto arrange components" })).toBeDisabled();
  });

  it("renders a supplied canvas message in the shared slot and wires Auto arrange", () => {
    const model = buildModel("component API service\nnorth -> API");
    const onAutoArrange = vi.fn();
    render(
      <DiagramCanvas
        model={model}
        customLayout={{
          version: 1,
          sourceFingerprint: "test",
          nodes: { API: { kind: "component", cellId: "main", x: 200, y: 200 } }
        }}
        canvasMessage={{ id: 1, tone: "warning", text: "Manual arrangement is temporary." }}
        onAutoArrange={onAutoArrange}
      />
    );

    const message = screen.getByRole("status");
    expect(message).toHaveTextContent("Manual arrangement is temporary.");
    expect(message).toHaveClass("canvas-notification");
    expect(message).toHaveAttribute("data-tone", "warning");
    expect(document.querySelectorAll(".canvas-notification")).toHaveLength(1);
    const button = screen.getByRole("button", { name: "Auto arrange components" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onAutoArrange).toHaveBeenCalledTimes(1);
  });

  it("uses the shared slot for the resting focus hint", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { container } = render(<DiagramCanvas model={model} />);

    const slot = screen.getByText("Click a component to focus its connections.");
    expect(slot).toHaveClass("canvas-notification");
    expect(slot).toHaveAttribute("data-mode", "hint");
    expect(container.querySelectorAll(".canvas-notification")).toHaveLength(1);
  });
});

describe("DiagramCanvas theming", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the light theme when no theme is supplied", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { container } = render(<DiagramCanvas model={model} />);

    expect(container.querySelector(".cell-diagram-root")).toHaveAttribute("data-cd-theme", "light");
  });

  it("stamps the dark theme onto the diagram root", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { container } = render(<DiagramCanvas model={model} theme="dark" />);

    expect(container.querySelector(".cell-diagram-root")).toHaveAttribute("data-cd-theme", "dark");
  });

  it("themes the empty-state placeholder too", () => {
    const { container } = render(<DiagramCanvas model={null} theme="dark" />);

    const root = container.querySelector(".cell-diagram-root");
    expect(root).toHaveClass("empty-canvas");
    expect(root).toHaveAttribute("data-cd-theme", "dark");
  });
});
