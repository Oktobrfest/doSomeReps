import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Toaster } from "sonner";
import styles from "./Toast.module.css";

/**
 * Where every toast in the document appears. Render exactly one, ahead of the
 * page it serves: sonner drops a toast raised before its host is listening,
 * and effects run in tree order.
 */
export function ToastHost() {
  // A fresh host for every visit, so a page restored from the back/forward
  // cache comes back without the toasts it had up when the reader left it.
  // Synchronously, so the stale ones are gone before the page is painted.
  const [visit, setVisit] = useState(0);

  useEffect(() => {
    const onPageShow = ({ persisted }: PageTransitionEvent) => {
      if (persisted) flushSync(() => setVisit((count) => count + 1));
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Expanded: sonner hides the content of a styled toast stacked behind the
  // front one, but a headless toast would show through it.
  return (
    <Toaster key={visit} position="top-right" expand toastOptions={{ className: styles.slot }} />
  );
}
