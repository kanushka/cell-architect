import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Diagnostic } from "../domain/cellModel";
import { EditorPanel } from "./EditorPanel";

function renderPanel(overrides: Partial<Parameters<typeof EditorPanel>[0]> = {}) {
  const props = {
    documentName: "Order System",
    onDocumentNameChange: vi.fn(),
    source: "component API service\n",
    onSourceChange: vi.fn(),
    diagnostics: [] as Diagnostic[],
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    ...overrides
  };
  render(<EditorPanel {...props} />);
  return props;
}

describe("EditorPanel", () => {
  it("shows the document name, source editor, and diagnostics when expanded", () => {
    renderPanel();

    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");
    expect(screen.getByLabelText("Cell DSL source")).toBeInTheDocument();
    expect(screen.getByText("No parser issues. The diagram is generated from this source.")).toBeInTheDocument();
  });

  it("lists parser diagnostics instead of the success message when present", () => {
    renderPanel({
      diagnostics: [{ severity: "error", message: "Unexpected token", line: 3, column: 5 }]
    });

    expect(screen.getByText("Unexpected token")).toBeInTheDocument();
    expect(screen.getByText("Line 3, col 5")).toBeInTheDocument();
    expect(screen.queryByText("No parser issues. The diagram is generated from this source.")).not.toBeInTheDocument();
  });

  it("hides the editor body when collapsed and shows the expand control", () => {
    renderPanel({ collapsed: true });

    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand editor" })).toBeInTheDocument();
  });

  it("calls onToggleCollapsed when the collapse/expand control is clicked", async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.click(screen.getByRole("button", { name: "Collapse editor" }));
    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("calls onDocumentNameChange and onSourceChange when edited", async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.clear(screen.getByLabelText("Diagram name"));
    await user.type(screen.getByLabelText("Diagram name"), "X");
    expect(props.onDocumentNameChange).toHaveBeenCalled();

    await user.type(screen.getByLabelText("Cell DSL source"), "!");
    expect(props.onSourceChange).toHaveBeenCalled();
  });
});
