import { toast } from "sonner";
import { Toast, type ToastSeverity } from "./Toast";

/**
 * Raise a toast of `severity`. Sonner only stacks, places and announces it;
 * `Toast` draws it and decides how long it lives, so sonner's own timer is
 * off. So is its swipe-to-dismiss, which would fight a long message's scroll.
 */
interface NotifyOptions {
  id?: string | number;
  persistent?: boolean;
}

const raise = (severity: ToastSeverity) => (message: string, options: NotifyOptions = {}) => {
  return toast.custom(
    (id) => <Toast severity={severity} message={message} persistent={options.persistent} onDismiss={() => toast.dismiss(id)} />,
    { id: options.id, duration: Infinity, dismissible: false }
  );
};

/** The one way anything in the app tells the reader something in a toast. */
export const notify = {
  success: raise("success"),
  info: raise("info"),
  warning: raise("warning"),
  error: raise("error"),
  dismiss: toast.dismiss,
} as const;
