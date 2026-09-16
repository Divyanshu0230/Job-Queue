import { Overlay } from './ui';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  pending,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Overlay onClose={onCancel}>
      <div className="modal modal--narrow" role="alertdialog">
        <h2>{title}</h2>
        <p className="modal__lede">{body}</p>
        <div className="modal__actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-btn" disabled={pending} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </Overlay>
  );
}
