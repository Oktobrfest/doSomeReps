import { useState, useRef, useCallback } from 'react';
import { Check, X, Minus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode, TouchEvent } from 'react';
import actionStyles from './ActionButton.module.css';
import styles from './AnswerButtons.module.css';

interface AnswerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'correct' | 'wrong' | 'slightlyWrong';
}

function AnswerButton({ variant, className, children, ...props }: AnswerButtonProps) {
  const variantClass =
    variant === 'correct'
      ? actionStyles.greenBtn
      : variant === 'wrong'
        ? actionStyles.redBtn
        : actionStyles.orangeBtn;

  return (
    <button
      type="button"
      className={`${styles.btn} ${variantClass} ${className || ''}`}
      {...props}
    >
      {variant === 'correct' && <Check className={styles.icon} />}
      {variant === 'wrong' && <X className={styles.icon} />}
      {variant === 'slightlyWrong' && <Minus className={styles.icon} />}
      <span>{children}</span>
    </button>
  );
}

export interface ExtraAction {
  key: string;
  label: string;
  icon: ReactNode;
  variant: 'exclude' | 'edit';
  submitName?: string;
  submitValue?: string;
  href?: string;
}

export interface AnswerButtonsProps {
  className?: string;
  size?: 'default' | 'compact';
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
  extraActions?: ExtraAction[];
}

export function AnswerButtons({
  className,
  size = 'default',
  onCorrect,
  onWrong,
  onSlightlyWrong,
  extraActions,
}: AnswerButtonsProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasExtra = extraActions && extraActions.length > 0;

  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (touchStartY.current == null) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    // Swipe up (finger moved upward by 30px+) opens; swipe down closes
    if (deltaY > 30) {
      setDrawerOpen(true);
    } else if (deltaY < -20) {
      setDrawerOpen(false);
    }
    touchStartY.current = null;
  }, []);

  return (
    <div
      className={`${styles.container} ${size === 'compact' ? styles.sizeCompact : ''} ${className || ''}`}
    >
      {hasExtra && (
        <div
          className={styles.grip}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setDrawerOpen((o) => !o)}
          role="button"
          aria-label={drawerOpen ? 'Collapse extra actions' : 'Expand extra actions'}
        >
          <span className={styles.gripBar} />
          <span className={styles.gripBar} />
          <span className={styles.gripBar} />
        </div>
      )}

      {onCorrect && (
        <AnswerButton variant="correct" onClick={onCorrect} className={styles.correct}>
          Correct!
        </AnswerButton>
      )}
      {onWrong && (
        <AnswerButton variant="wrong" onClick={onWrong} className={styles.secondary}>
          Wrong!
        </AnswerButton>
      )}
      {onSlightlyWrong && (
        <AnswerButton
          variant="slightlyWrong"
          onClick={onSlightlyWrong}
          className={styles.secondary}
        >
          Slightly Wrong
        </AnswerButton>
      )}

      {hasExtra && (
        <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
          {extraActions.map((action) => {
            if (action.href) {
              return (
                <a
                  key={action.key}
                  href={action.href}
                  className={`${styles.drawerBtn} ${action.variant === 'exclude' ? actionStyles.redBtn : actionStyles.cyanBtn}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className={actionStyles.btnContent}>
                    {action.icon}
                    <span>{action.label}</span>
                  </div>
                </a>
              );
            }
            return (
              <button
                key={action.key}
                type="submit"
                name={action.submitName}
                value={action.submitValue}
                className={`${styles.drawerBtn} ${action.variant === 'exclude' ? actionStyles.redBtn : actionStyles.cyanBtn}`}
              >
                <div className={actionStyles.btnContent}>
                  {action.icon}
                  <span>{action.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
