import { render, screen } from "@testing-library/react";
import { CellDiagram } from "./CellDiagram";

describe("CellDiagram", () => {
  it("renders a component node from DSL source", () => {
    render(<CellDiagram source={"component api service\nnorth -> api"} />);
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("reports diagnostics for invalid source and renders the empty state", () => {
    const onDiagnostics = vi.fn();
    render(<CellDiagram source={"api -> north"} onDiagnostics={onDiagnostics} />);
    expect(onDiagnostics).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ severity: "error" })])
    );
    expect(screen.getByText(/Fix the DSL errors/i)).toBeInTheDocument();
  });

  it("renders a directly-provided model without a source", () => {
    render(<CellDiagram model={{ cells: [{ id: "c", components: [{ id: "api" }], externals: [], edges: [] }], crossEdges: [], sharedExternals: [] }} />);
    expect(screen.getByText("api")).toBeInTheDocument();
  });
});
