import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Diagnostic } from "@kanushka/cell-diagram-react";
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

  it("groups mixed-mode diagnostics into one conversion card while keeping other issues", () => {
    const source = "component loose\nloose -> existing.api\ncell existing {\n  component api\n}";
    renderPanel({
      source,
      diagnostics: [
        {
          severity: "error",
          code: "mixed-cell-mode",
          message: "Mixed",
          line: 1,
          column: 1
        },
        {
          severity: "error",
          code: "mixed-cell-mode",
          message: "Mixed",
          line: 2,
          column: 1
        },
        { severity: "error", message: "Another issue", line: 7, column: 2 }
      ]
    });

    expect(screen.getAllByText("Complete multi-cell setup")).toHaveLength(1);
    expect(screen.queryByText("Mixed")).not.toBeInTheDocument();
    expect(screen.getByText("Another issue")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Complete multi-cell setup" })).toHaveTextContent(
      "Creates cell main and moves 2 loose statements."
    );
    expect(screen.getByRole("button", { name: "Convert to multi-cell" })).toHaveClass("pill-button");
  });

  it("applies the proposed one-click conversion through onSourceChange", async () => {
    const user = userEvent.setup();
    const source = "component loose\ncell main {\n  component api\n}";
    const props = renderPanel({
      source,
      diagnostics: [
        {
          severity: "error",
          code: "mixed-cell-mode",
          message: "Mixed",
          line: 1,
          column: 1
        }
      ]
    });

    expect(screen.getByRole("region", { name: "Complete multi-cell setup" })).toHaveTextContent(
      "Creates cell main-2 and moves 1 loose statement."
    );
    await user.click(screen.getByRole("button", { name: "Convert to multi-cell" }));

    expect(props.onSourceChange).toHaveBeenCalledWith(
      "cell main-2 {\n  component loose\n}\n\ncell main {\n  component api\n}"
    );
  });

  it("falls back to the line diagnostic when no safe conversion is available", () => {
    renderPanel({
      source: "cell existing {\n  component api\n}",
      diagnostics: [
        {
          severity: "error",
          code: "mixed-cell-mode",
          message: "Mixed source",
          line: 1,
          column: 1
        }
      ]
    });

    expect(screen.queryByRole("button", { name: "Convert to multi-cell" })).not.toBeInTheDocument();
    expect(screen.getByText("Mixed source")).toBeInTheDocument();
    expect(screen.getByText("Line 1, col 1")).toBeInTheDocument();
  });

  it("hides the entire panel when collapsed, showing only the expand control", () => {
    renderPanel({ collapsed: true });

    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Diagram name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand editor" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { name: "Show text editor" })).toBeInTheDocument();
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

    expect(screen.getByRole("tooltip", { name: "Hide text editor" })).toBeInTheDocument();
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
