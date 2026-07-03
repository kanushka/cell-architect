import { Copy, Download, Eye, FilePlus2, MoreVertical, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DiagramDocument } from "../storage/documentRepository";

interface DiagramsPanelProps {
  documents: DiagramDocument[];
  activeDocumentId: string;
  isAtDocumentLimit: boolean;
  onSelect: (id: string) => void;
  onNewDocument: () => void;
  onImportClick: () => void;
  onDuplicate: (document: DiagramDocument) => void;
  onExport: (document: DiagramDocument) => void;
  onDelete: (document: DiagramDocument) => void;
  onClose: () => void;
}

export function DiagramsPanel({
  documents,
  activeDocumentId,
  isAtDocumentLimit,
  onSelect,
  onNewDocument,
  onImportClick,
  onDuplicate,
  onExport,
  onDelete,
  onClose
}: DiagramsPanelProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".diagrams-panel__menu-button") && !target.closest(".diagrams-panel__menu")) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openMenuId]);

  return (
    <div className="diagrams-panel">
      <div className="diagrams-panel__header">
        <span>Diagrams</span>
        <div className="diagrams-panel__header-actions">
          <button type="button" className="icon-button" aria-label="Close diagrams panel" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="diagrams-panel__actions" role="group" aria-label="Diagram actions">
        <div className="tooltip-control tooltip-control--wide">
          <button
            type="button"
            className="diagrams-panel__action-button"
            aria-label="New diagram"
            aria-describedby="new-diagram-tooltip"
            disabled={isAtDocumentLimit}
            onClick={onNewDocument}
          >
            <FilePlus2 size={16} />
            <span>New</span>
          </button>
          <span id="new-diagram-tooltip" role="tooltip" className="app-tooltip app-tooltip--panel">
            Create a new diagram
          </span>
        </div>
        <div className="tooltip-control tooltip-control--wide">
          <button
            type="button"
            className="diagrams-panel__action-button"
            aria-label="Import .cell"
            aria-describedby="import-diagram-tooltip"
            disabled={isAtDocumentLimit}
            onClick={onImportClick}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <span id="import-diagram-tooltip" role="tooltip" className="app-tooltip app-tooltip--panel">
            Import a .cell or .txt file
          </span>
        </div>
      </div>
      <nav className="diagrams-panel__list" aria-label="Saved diagrams">
        {documents.map((document) => (
          <div
            key={document.id}
            className={
              document.id === activeDocumentId
                ? "diagrams-panel__item diagrams-panel__item--active"
                : "diagrams-panel__item"
            }
          >
            <button type="button" className="diagrams-panel__select" onClick={() => onSelect(document.id)}>
              <strong>{document.name}</strong>
              <small>{new Date(document.updatedAt).toLocaleString()}</small>
            </button>
            <button
              type="button"
              className="diagrams-panel__menu-button"
              aria-label={`More actions for ${document.name}`}
              aria-haspopup="menu"
              aria-expanded={openMenuId === document.id}
              onClick={() => setOpenMenuId((current) => (current === document.id ? null : document.id))}
            >
              <MoreVertical size={16} />
            </button>
            {openMenuId === document.id ? (
              <div className="diagrams-panel__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(document.id);
                    setOpenMenuId(null);
                  }}
                >
                  <Eye size={15} />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isAtDocumentLimit}
                  onClick={() => {
                    onDuplicate(document);
                    setOpenMenuId(null);
                  }}
                >
                  <Copy size={15} />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExport(document);
                    setOpenMenuId(null);
                  }}
                >
                  <Download size={15} />
                  <span>Export .cell</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="diagrams-panel__menu-danger"
                  onClick={() => {
                    onDelete(document);
                    setOpenMenuId(null);
                  }}
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </div>
  );
}
