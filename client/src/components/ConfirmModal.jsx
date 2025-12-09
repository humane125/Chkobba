import PropTypes from 'prop-types';

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

ConfirmModal.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ConfirmModal.defaultProps = {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
};

export default ConfirmModal;
