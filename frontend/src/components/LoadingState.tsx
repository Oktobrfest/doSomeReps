import sharedStyles from "../styles/shared.module.css";

interface LoadingStateProps {
  /** Caption under the spinner. Omit where the surrounding copy already says. */
  message?: string;
  /** What a screen reader hears while the spinner turns. */
  label?: string;
}

/** The app's in-flight indicator: a spinner, announced to assistive tech. */
export function LoadingState({ message, label = "Loading..." }: LoadingStateProps) {
  return (
    <div className={sharedStyles.loadingState}>
      <div className={sharedStyles.spinner} role="status">
        <span className={sharedStyles.srOnly}>{label}</span>
      </div>
      {message && <p className={sharedStyles.loadingText}>{message}</p>}
    </div>
  );
}
