import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useDocumentVisible } from "../hooks/useDocumentVisible";
import sharedStyles from "../styles/shared.module.css";
import styles from "./Toast.module.css";

/**
 * Everything that varies by severity: the alert colours a toast wears, its
 * icon, what that icon says to a screen reader, and whether the toast times
 * out. An error never does; it stays until the reader dismisses it or leaves.
 */
const SEVERITIES = {
  success: { alert: sharedStyles.alertSuccess, Icon: CircleCheck, label: "Success", timesOut: true },
  info: { alert: sharedStyles.alertInfo, Icon: Info, label: "Info", timesOut: true },
  warning: { alert: sharedStyles.alertWarning, Icon: TriangleAlert, label: "Warning", timesOut: true },
  error: { alert: sharedStyles.alertError, Icon: CircleX, label: "Error", timesOut: false },
} satisfies Record<string, { alert: string; Icon: LucideIcon; label: string; timesOut: boolean }>;

export type ToastSeverity = keyof typeof SEVERITIES;

interface ToastProps {
  severity: ToastSeverity;
  message: string;
  onDismiss: () => void;
}

/**
 * One toast: its severity's icon, the message, and a dismiss at the top right.
 *
 * A timed toast drains a countdown along its bottom edge and fades out over
 * the end of it. The countdown finishing is what dismisses it, so the
 * stylesheet is the only clock and the bar can never disagree with it.
 */
export function Toast({ severity, message, onDismiss }: ToastProps) {
  const { alert, Icon, label, timesOut } = SEVERITIES[severity];

  // The clock only runs while the page is in front, and starts over when the
  // reader comes back to it. Keying on that gives the toast fresh elements,
  // and so fresh animations: a hidden page cannot be relied on to restyle.
  const visible = useDocumentVisible();
  const timed = timesOut && visible;

  return (
    <div key={String(timed)} className={`${styles.toast} ${alert} ${timed ? styles.timed : ""}`}>
      <Icon className={styles.icon} role="img" aria-label={label} />
      <p className={styles.message}>{message}</p>
      <button
        type="button"
        className={`${sharedStyles.actionButton} ${sharedStyles.buttonTouchXs} ${sharedStyles.buttonRound} ${sharedStyles.btnOverlay}`}
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X className={sharedStyles.buttonIcon} aria-hidden="true" />
      </button>
      {timed && (
        <span className={styles.countdown} aria-hidden="true" onAnimationEnd={onDismiss} />
      )}
    </div>
  );
}
