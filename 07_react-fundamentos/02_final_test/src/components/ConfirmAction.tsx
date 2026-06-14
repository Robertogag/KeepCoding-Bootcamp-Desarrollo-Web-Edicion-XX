interface ConfirmActionProps {
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmAction({
    message,
    confirmLabel,
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
}: ConfirmActionProps) {
    return (
        <div className="confirm-box">
            <p>{message}</p>
            <div className="confirm-box__actions">
                <button
                    type="button"
                    className="button button--danger"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </button>
                <button
                    type="button"
                    className="button button--secondary"
                    onClick={onCancel}
                >
                    {cancelLabel}
                </button>
            </div>
        </div>
    );
}
