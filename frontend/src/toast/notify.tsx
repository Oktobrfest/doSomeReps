import { toast } from "sonner";
import { Toast, type ToastLink, type ToastSeverity } from "./Toast";

interface NotifyOptions {
  id?: string | number;
  persistent?: boolean;
  link?: ToastLink;
}

let raised = 0;

/**
 * Raise a toast of `severity`. Sonner only stacks, places and announces it;
 * `Toast` draws it and decides how long it lives, so sonner's own timer is
 * off. So is its swipe-to-dismiss, which would fight a long message's scroll.
 *
 * The id is settled here, before sonner sees the toast, and it is the same id
 * the toast's dismiss closes. Raising again under an `id` updates that toast.
 */
const raise = (severity: ToastSeverity) =>
  (message: string, { id = `notify-${++raised}`, persistent, link }: NotifyOptions = {}) =>
    toast.custom(
      () => <Toast severity={severity} message={message} persistent={persistent} link={link} onDismiss={() => toast.dismiss(id)} />,
      { id, duration: Infinity, dismissible: false }
    );

/** The one way anything in the app tells the reader something in a toast. */
export const notify = {
  success: raise("success"),
  info: raise("info"),
  warning: raise("warning"),
  error: raise("error"),
  dismiss: toast.dismiss,
} as const;
