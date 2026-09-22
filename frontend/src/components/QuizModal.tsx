import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './QuizModal.module.css';

interface QuizModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Give the dialog the whole screen, for work that wants every pixel of it. */
  fullScreen?: boolean;
}

/**
 * Dialog shell for the app's secondary surfaces.
 *
 * They live in modals so the page itself keeps the whole screen: a phone only
 * has room for the button that opens them.
 */
export function QuizModal({ title, onClose, children, fullScreen = false }: QuizModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest close callback without re-running the mount focus effect.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus the dialog only when it mounts: keystrokes in a field inside it must
  // never bounce focus back out to the panel.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return createPortal(
    <div
      className={`${styles.backdrop} ${fullScreen ? styles.backdropFull : ""}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${fullScreen ? styles.panelFull : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
