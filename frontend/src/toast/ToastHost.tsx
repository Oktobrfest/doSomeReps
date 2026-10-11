import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import styles from "./Toast.module.css";

/**
 * Where every toast in the document appears. Render exactly one: a second
 * host would show every toast twice.
 */
export function ToastHost() {
  // A page restored from the back/forward cache comes back without the toasts
  // it had up when the reader left it.
  useEffect(() => {
    const onPageShow = ({ persisted }: PageTransitionEvent) => {
      if (persisted) toast.dismiss();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Expanded: sonner hides the content of a styled toast stacked behind the
  // front one, but a headless toast would show through it.
  return <Toaster position="top-right" expand toastOptions={{ className: styles.slot }} />;
}
