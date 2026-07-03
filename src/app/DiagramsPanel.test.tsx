import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DiagramDocument } from "../storage/documentRepository";
import { DiagramsPanel } from "./DiagramsPanel";

function buildDocument(overrides: Partial<DiagramDocument> = {}): DiagramDocument {
  return {
    id: "doc-1",
    name: "Order System",
    source: "component API service\n",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function renderPanel(overrides: Partial<Parameters<typeof DiagramsPanel>[0]> = {}) {
  const props = {
    documents: [buildDocument()],
    activeDocumentId: "doc-1",
    isAtDocumentLimit: false,
    onSelect: vi.fn(),
    onNewDocument: vi.fn(),
    onImportClick: vi.fn(),
    onDuplicate: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  render(<DiagramsPanel {...props} />);
  return props;
}

describe("DiagramsPanel", () => {
  it("lists documents and selects one on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const documents = [buildDocument(), buildDocument({ id: "doc-2", name: "Untitled Cell" })];

    renderPanel({ documents, onSelect });

    expect(screen.getByText("Order System")).toBeInTheDocument();
    expect(screen.getByText("Untitled Cell")).toBeInTheDocument();

    await user.click(screen.getByText("Untitled Cell"));
    expect(onSelect).toHaveBeenCalledWith("doc-2");
  });

  it("opens the row menu and exposes duplicate, export, and delete", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const documents = [buildDocument()];

    renderPanel({ documents, onDuplicate, onExport, onDelete });

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledWith(documents[0]);

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Export .cell" }));
    expect(onExport).toHaveBeenCalledWith(documents[0]);

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(documents[0]);
  });

  it("disables duplicate at the document limit and closes via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderPanel({ isAtDocumentLimit: true, onClose });

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Close diagrams panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows New and Import actions in a row before the diagram tiles with tooltips", async () => {
    const user = userEvent.setup();
    const onNewDocument = vi.fn();
    const onImportClick = vi.fn();

    renderPanel({ onNewDocument, onImportClick });

    const actionRow = screen.getByRole("group", { name: "Diagram actions" });
    const diagramList = screen.getByRole("navigation", { name: "Saved diagrams" });
    expect(actionRow.compareDocumentPosition(diagramList)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(actionRow).toHaveTextContent("New");
    expect(actionRow).toHaveTextContent("Import");
    expect(screen.getByRole("tooltip", { name: "Create a new diagram" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { name: "Import a .cell or .txt file" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New diagram" }));
    expect(onNewDocument).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Import .cell" }));
    expect(onImportClick).toHaveBeenCalledTimes(1);
  });

  it("disables New diagram and Import at the document limit", () => {
    renderPanel({ isAtDocumentLimit: true });

    expect(screen.getByRole("button", { name: "New diagram" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import .cell" })).toBeDisabled();
  });

  it("closes the row menu when clicking outside it", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("Diagrams"));

    expect(screen.queryByRole("menuitem", { name: "Duplicate" })).not.toBeInTheDocument();
  });
});
