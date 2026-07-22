import { Trash2 } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="pill-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="modal-danger-button" onClick={onConfirm}>
          <Trash2 size={15} />
          <span>{confirmLabel}</span>
        </button>
      </div>
    </Modal>
  );
}
