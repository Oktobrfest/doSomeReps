import { useState, useRef, useCallback } from 'react';
import { Check, X, Minus, ChevronUp } from 'lucide-react';
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
  // States: 'hidden' | 'collapsed' | 'expanded'
  const [panelState, setPanelState] = useState<'hidden' | 'collapsed' | 'expanded'>('collapsed');
  const hasExtra = extraActions && extraActions.length > 0;

  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY;

    // Optional: Visual dragging feedback can be added here,
    // but a clean transition on TouchEnd is extremely robust and avoids lag.
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === null || touchCurrentY.current === null) return;
    const deltaY = touchStartY.current - touchCurrentY.current;

    if (Math.abs(deltaY) > 40) {
      if (deltaY > 0) {
        // Swiped Up
        if (panelState === 'hidden') {
          setPanelState('collapsed');
        } else if (panelState === 'collapsed' && hasExtra) {
          setPanelState('expanded');
        }
      } else {
        // Swiped Down
        if (panelState === 'expanded') {
          setPanelState('collapsed');
        } else if (panelState === 'collapsed') {
          setPanelState('hidden');
        }
      }
    }

    touchStartY.current = null;
    touchCurrentY.current = null;
  }, [panelState, hasExtra]);

  // Click handler to toggle or restore
  const handleGripClick = useCallback(() => {
    if (panelState === 'hidden') {
      setPanelState('collapsed');
    } else if (panelState === 'collapsed') {
      if (hasExtra) {
        setPanelState('expanded');
      } else {
        setPanelState('hidden');
      }
    } else {
      setPanelState('collapsed');
    }
  }, [panelState, hasExtra]);

  // Swipe tracking for restore tab
  const restoreTouchStartY = useRef<number | null>(null);

  const handleRestoreTouchStart = useCallback((e: TouchEvent) => {
    restoreTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleRestoreTouchEnd = useCallback((e: TouchEvent) => {
    if (restoreTouchStartY.current === null) return;
    const deltaY = restoreTouchStartY.current - e.changedTouches[0].clientY;
    // Swipe up on the restore arrow pulls the panel back up
    if (deltaY > 20) {
      setPanelState('collapsed');
    }
    restoreTouchStartY.current = null;
  }, []);

  return (
    <>
      {/* Subtle restore handle if hidden entirely */}
      {panelState === 'hidden' && (
        <button
          type="button"
          className={styles.restoreTab}
          onTouchStart={handleRestoreTouchStart}
          onTouchEnd={handleRestoreTouchEnd}
          onClick={() => setPanelState('collapsed')}
          aria-label="Restore action buttons"
        >
          <ChevronUp className={styles.restoreArrow} />
        </button>
      )}

      <div
        ref={containerRef}
        className={`${styles.container} ${size === 'compact' ? styles.sizeCompact : ''} ${
          panelState === 'expanded' ? styles.stateExpanded : panelState === 'hidden' ? styles.stateHidden : styles.stateCollapsed
        } ${className || ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasExtra && (
          <div
            className={styles.grip}
            onClick={handleGripClick}
            role="button"
            aria-label="Toggle extra actions panel"
          >
            <span className={styles.gripBar} />
            <span className={styles.gripBar} />
            <span className={styles.gripBar} />
          </div>
        )}

        <div className={styles.buttonsRow}>
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
        </div>

        {hasExtra && (
          <div className={styles.drawer}>
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
    </>
  );
}
