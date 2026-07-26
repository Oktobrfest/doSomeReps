import sharedStyles from "../styles/shared.module.css";

interface QuestionEditorAlertProps {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}

export function QuestionEditorAlert({
  type,
  message,
  onDismiss,
}: QuestionEditorAlertProps) {
  const alertClass =
    type === "success" ? sharedStyles.alertSuccess : sharedStyles.alertError;
  const label = type === "success" ? "Success!" : "Error!";

  return (
    <div className={`${sharedStyles.alert} ${alertClass}`} role="alert">
      <strong>{label}</strong> {message}
      <button
        type="button"
        className={sharedStyles.alertCloseButton}
        onClick={onDismiss}
      >
        <span>&times;</span>
      </button>
    </div>
  );
}
