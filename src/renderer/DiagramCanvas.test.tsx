import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not expose the unfinished SVG and PNG export controls", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);
    expect(screen.queryByRole("button", { name: /export png/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export svg/i })).not.toBeInTheDocument();
  });
});
