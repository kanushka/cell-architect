import { Check } from "lucide-react";
import { Modal } from "./Modal";

const PREVIEW_LINES = 12;

interface ShareImportPromptProps {
  name: string;
  source: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function previewOf(source: string) {
  const lines = source.split("\n");
  const shown = lines.slice(0, PREVIEW_LINES).join("\n");
  return lines.length > PREVIEW_LINES
    ? `${shown}\n… ${lines.length - PREVIEW_LINES} more lines`
    : shown;
}

/**
 * Asks before a share link writes into the visitor's library.
 *
 * A share link is just a URL, so following one is not consent to have a diagram
 * added to your saved documents. The preview also lets someone see what a link
 * from an untrusted source contains before keeping it.
 */
export function ShareImportPrompt({ name, source, onConfirm, onCancel }: ShareImportPromptProps) {
  return (
    <Modal title="Open shared diagram" onClose={onCancel}>
      <p>
        This link contains a diagram called <strong>{name}</strong>. Add it to your diagrams?
      </p>
      <pre className="share-preview" aria-label={`Preview of ${name}`}>
        {previewOf(source)}
      </pre>
      <div className="modal-actions">
        <button type="button" className="pill-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="modal-confirm-button" onClick={onConfirm}>
          <Check size={15} />
          <span>Add to my diagrams</span>
        </button>
      </div>
    </Modal>
  );
}
