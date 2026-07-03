import { render, screen } from "@testing-library/react";
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

describe("DiagramsPanel", () => {
  it("lists documents and selects one on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const documents = [buildDocument(), buildDocument({ id: "doc-2", name: "Untitled Cell" })];

    render(
      <DiagramsPanel
        documents={documents}
        activeDocumentId="doc-1"
        isAtDocumentLimit={false}
        onSelect={onSelect}
        onDuplicate={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );

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

    render(
      <DiagramsPanel
        documents={documents}
        activeDocumentId="doc-1"
        isAtDocumentLimit={false}
        onSelect={vi.fn()}
        onDuplicate={onDuplicate}
        onExport={onExport}
        onDelete={onDelete}
        onClose={vi.fn()}
      />
    );

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
    const documents = [buildDocument()];

    render(
      <DiagramsPanel
        documents={documents}
        activeDocumentId="doc-1"
        isAtDocumentLimit
        onSelect={vi.fn()}
        onDuplicate={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Close diagrams panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
