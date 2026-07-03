import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Diagnostic } from "../domain/cellModel";
import { EDITOR_DEFAULT_WIDTH } from "./layoutConstants";
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
    width: EDITOR_DEFAULT_WIDTH,
    onWidthChange: vi.fn(),
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

  it("hides the entire panel when collapsed, showing only the expand control", () => {
    renderPanel({ collapsed: true });

    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Diagram name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand editor" })).toBeInTheDocument();
  });

  it("calls onToggleCollapsed when the expand control is clicked", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ collapsed: true });

    await user.click(screen.getByRole("button", { name: "Expand editor" }));
    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
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

describe("EditorPanel resizing", () => {
  it("resizes width and height by dragging the resize handle", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 300 });
    fireEvent.mouseMove(window, { clientX: 340, clientY: 260 });
    fireEvent.mouseUp(window);

    expect(onWidthChange).toHaveBeenLastCalledWith(360);
  });

  it("clamps the resized width to the configured maximum", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 5000, clientY: 0 });
    fireEvent.mouseUp(window);

    expect(onWidthChange).toHaveBeenLastCalledWith(560);
  });

  it("clamps the resized width to the configured minimum", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: -5000, clientY: 0 });
    fireEvent.mouseUp(window);

    expect(onWidthChange).toHaveBeenLastCalledWith(260);
  });

  it("stops resizing after mouseup", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseUp(window);
    onWidthChange.mockClear();

    fireEvent.mouseMove(window, { clientX: 100, clientY: 0 });
    expect(onWidthChange).not.toHaveBeenCalled();
  });
});
