interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="confirmation-modal">
        <div className="modal-content">
          <h3 className="modal-title">{title}</h3>
          <p className="modal-message">{message}</p>
          <div className="modal-actions">
            <button className="btn-secondary" type="button" onClick={onCancel}>
              {cancelText}
            </button>
            <button
              className={isDangerous ? 'btn-danger' : 'btn-primary'}
              type="button"
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
