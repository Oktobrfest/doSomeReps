import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './QuizModal.module.css';

interface QuizModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Dialog shell for the quiz's secondary actions.
 *
 * These actions live in modals so the question itself keeps the whole screen:
 * the slide-out panel only has room for the buttons that open them.
 */
export function QuizModal({ title, onClose, children }: QuizModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
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
