import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileCellSource } from "../compiler/compileCellSource";

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
  const compiled = compileCellSource(source);
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
});

describe("DiagramCanvas component styling", () => {
  it("marks API components so they can use the same orange circle treatment as API externals", () => {
    const model = buildModel("component books api");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByText("books").closest(".component-node")).toHaveClass("component-node--api");
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
});
