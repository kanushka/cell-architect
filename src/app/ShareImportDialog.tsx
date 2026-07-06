import { Download, Trash2 } from "lucide-react";
import { DiagramDocument } from "../storage/documentRepository";
import { Modal } from "./Modal";

interface ShareImportDialogProps {
  documents: DiagramDocument[];
  onExport: (document: DiagramDocument) => void;
  onDeleteAndSave: (document: DiagramDocument) => void;
  onCancel: () => void;
}

export function ShareImportDialog({ documents, onExport, onDeleteAndSave, onCancel }: ShareImportDialogProps) {
  return (
    <Modal title="Library is full" onClose={onCancel}>
      <p>
        You already have {documents.length} diagrams, the maximum allowed. To save this shared diagram, delete one
        below. <strong>Export it first if you want to keep it &mdash; deleting is permanent.</strong>
      </p>
      <div className="share-import-list">
        {documents.map((document) => (
          <div className="share-import-row" key={document.id}>
            <strong>{document.name}</strong>
            <div className="share-import-row__actions">
              <button
                type="button"
                className="icon-button"
                aria-label={`Export ${document.name}`}
                onClick={() => onExport(document)}
              >
                <Download size={15} />
              </button>
              <button
                type="button"
                className="modal-danger-button"
                onClick={() => onDeleteAndSave(document)}
              >
                <Trash2 size={15} />
                <span>Delete &amp; save shared</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="pill-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
