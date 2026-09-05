import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ButtonHTMLAttributes,
  type ReactNode,
  type PointerEvent,
} from 'react';
import { Check, X, Minus } from 'lucide-react';
import { AuthorButton, type QuestionAuthor } from './AuthorButton';
import { ToggleButton } from './AudioControls';
import { CategoriesSection } from './CategoriesSection';
import { FlagButton, type QuestionFlag } from '../components/FlagButton';
import sharedStyles from '../styles/shared.module.css';
import styles from './SlideOutButtons.module.css';

/** Class list for one control in the panel: base + size + intent. */
function panelBtn(intent: string, size: string = sharedStyles.buttonTouchSm) {
  return `${sharedStyles.actionButton} ${size} ${sharedStyles.buttonWrap} ${intent}`;
}

const VERDICT_INTENT = {
  correct: sharedStyles.btnGreen,
  wrong: sharedStyles.btnRed,
  slightlyWrong: sharedStyles.btnAmber,
} as const;

const VERDICT_ICON = {
  correct: Check,
  wrong: X,
  slightlyWrong: Minus,
} as const;

interface SlideOutActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: keyof typeof VERDICT_INTENT;
  /** The size tier the panel is running at, so the modal can use a denser one. */
  sizeClass: string;
}

function SlideOutActionButton({
  variant,
  sizeClass,
  className,
  children,
  ...props
}: SlideOutActionButtonProps) {
  const Icon = VERDICT_ICON[variant];

  return (
    <button
      type="button"
      className={`${panelBtn(VERDICT_INTENT[variant], sizeClass)} ${className || ''}`}
      {...props}
    >
      <Icon className={sharedStyles.buttonIcon} />
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
  onClick?: () => void;
}

/**
 * A secondary action that opens a dialog rather than changing the quiz.
 *
 * These share a row instead of taking a full-width button each, so the panel
 * can carry more of them without pushing the verdict buttons off screen.
 */
export interface CompactAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

export interface SlideOutButtonsProps {
  className?: string;
  size?: 'default' | 'compact';
  disabled?: boolean;
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
  extraActions?: ExtraAction[];
  compactActions?: CompactAction[];
  onSnapChange?: (snap: 'collapsed' | 'trio' | 'full') => void;
  /** Reports the measured panel heights so content can clear the docked panel. */
  onMetricsChange?: (metrics: Metrics) => void;
  expandToTrio?: boolean;
  showCategories?: boolean;
  categoryList?: string[];
  initialSelectedCategories?: string[];
  onApplyCategories?: (categories: string[]) => void;
  questionId?: string | number;
  author?: QuestionAuthor;
  initialFlag?: QuestionFlag | null;
  csrfToken?: string;
  onFlagChange?: (newFlag: QuestionFlag | null) => void;
  audioEnabled?: boolean;
  onToggleAudioEnabled?: () => void;
  autoPlay?: boolean;
  onToggleAutoPlay?: () => void;
}

export interface SlideOutButtonsHandle {
  /** Snap the panel back to the collapsed position. */
  collapse: () => void;
}

export interface Metrics {
  collapsed: number;
  trio: number;
  full: number;
}

export const SlideOutButtons = forwardRef<SlideOutButtonsHandle, SlideOutButtonsProps>(function SlideOutButtons(
  {
    className,
    size = 'default',
    disabled = false,
    onCorrect,
    onWrong,
    onSlightlyWrong,
    extraActions,
    compactActions,
    onSnapChange,
    onMetricsChange,
    expandToTrio = false,
    showCategories = false,
    categoryList,
    initialSelectedCategories,
    onApplyCategories,
    questionId,
    author,
    initialFlag,
    csrfToken,
    onFlagChange,
    audioEnabled,
    onToggleAudioEnabled,
    autoPlay,
    onToggleAutoPlay,
  }: SlideOutButtonsProps,
  ref,
) {
  const hasExtra =
    Boolean(extraActions?.length) ||
    Boolean(compactActions?.length) ||
    Boolean(questionId) ||
    Boolean(author) ||
    Boolean(onToggleAudioEnabled);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const buttonsRowRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useImperativeHandle(ref, () => ({
    collapse: () => {
      autoExpanded.current = false;
      if (metrics) {
        setCurrentHeight(metrics.collapsed);
      }
    },
  }), [metrics]);

  const autoExpanded = useRef(false);

  const isDraggingRef = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const hasDragged = useRef(false);

  const measure = useCallback(() => {
    const panel = containerRef.current;
    const grip = gripRef.current;
    const body = bodyRef.current;
    const buttons = buttonsRowRef.current;

    if (!panel || !grip || !body || !buttons) return;

    const panelStyle = getComputedStyle(panel);
    const padTop = parseFloat(panelStyle.paddingTop) || 0;
    const padBottom = parseFloat(panelStyle.paddingBottom) || 0;
    const gap = parseFloat(panelStyle.gap) || 0;

    const collapsed = padTop + grip.offsetHeight + padBottom;
    const trio = collapsed + gap + buttons.offsetHeight;
    const natural = collapsed + gap + body.scrollHeight;

    // The cap is the panel's CSS max-height, so the number is written down once
    // and the tier can never ask for a height the panel is not allowed to take.
    // Whatever the cap cuts off is reached by scrolling the body instead.
    const cap = parseFloat(panelStyle.maxHeight);
    const full = Number.isNaN(cap) ? natural : Math.max(trio, Math.min(natural, cap));

    setMetrics({ collapsed, trio, full });
  }, []);

  useEffect(() => {
    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const targets = [
      gripRef.current,
      buttonsRowRef.current,
      drawerRef.current,
      categoriesRef.current,
    ].filter(Boolean) as Element[];

    const resizeObserver = new ResizeObserver(measure);
    targets.forEach((el) => resizeObserver.observe(el));

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [measure, showCategories, hasExtra]);

  useEffect(() => {
    if (!metrics) return;
    onMetricsChange?.(metrics);
  }, [metrics, onMetricsChange]);

  useEffect(() => {
    if (!metrics) return;

    setCurrentHeight((prev) => {
      if (prev == null) return metrics.collapsed;
      return Math.max(metrics.collapsed, Math.min(prev, metrics.full));
    });
  }, [metrics]);

  useEffect(() => {
    if (
      expandToTrio &&
      metrics &&
      currentHeight === metrics.collapsed &&
      !autoExpanded.current
    ) {
      autoExpanded.current = true;

      requestAnimationFrame(() => {
        setCurrentHeight(metrics.trio);
      });
    }
  }, [expandToTrio, metrics, currentHeight]);

  const lastSnap = useRef<'collapsed' | 'trio' | 'full' | null>(null);

  useEffect(() => {
    if (!metrics || currentHeight == null || isDragging) return;

    let snap: 'collapsed' | 'trio' | 'full' = 'collapsed';
    const low = (metrics.collapsed + metrics.trio) / 2;
    const high = (metrics.trio + metrics.full) / 2;

    if (currentHeight > low) snap = 'trio';
    if (currentHeight > high) snap = 'full';

    if (snap !== lastSnap.current) {
      lastSnap.current = snap;
      onSnapChange?.(snap);
    }
  }, [currentHeight, isDragging, metrics, onSnapChange]);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || !metrics || !gripRef.current || e.button !== 0) return;

      e.preventDefault();

      isDraggingRef.current = true;
      setIsDragging(true);
      hasDragged.current = false;
      startY.current = e.clientY;
      startHeight.current = currentHeight ?? metrics.collapsed;

      try {
        gripRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failures.
      }
    },
    [currentHeight, disabled, metrics],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !metrics) return;

      const deltaY = startY.current - e.clientY;
      if (Math.abs(deltaY) > 4) hasDragged.current = true;

      const next = Math.max(
        metrics.collapsed,
        Math.min(startHeight.current + deltaY, metrics.full),
      );

      setCurrentHeight(next);
    },
    [metrics],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current || !metrics) return;

    isDraggingRef.current = false;
    setIsDragging(false);

    if (!hasDragged.current) {
      const wasOpen = startHeight.current > metrics.collapsed + 2;
      setCurrentHeight(wasOpen ? metrics.collapsed : metrics.trio);
    }
  }, [metrics]);

  // At the top tier the drag has nothing left to give, which is the point the
  // body takes the vertical scroll over from the page behind the panel.
  const atFull = metrics != null && currentHeight != null && currentHeight >= metrics.full;

  // Below it the body is clipped again, and a scroll offset left behind would
  // park the verdict row off the top of the panel.
  useEffect(() => {
    if (atFull) return;

    const body = bodyRef.current;
    if (body) body.scrollTop = 0;
  }, [atFull]);

  // The image modal shows the same verdicts over a photo, where the full-height
  // tier would swallow the picture, so it drops one tier.
  const verdictSize =
    size === 'compact' ? sharedStyles.buttonTouchSm : sharedStyles.buttonTouchMd;

  const containerClasses = [
    styles.container,
    isDragging ? styles.dragging : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      style={{
        height: currentHeight ?? 'auto',
        visibility: currentHeight != null ? 'visible' : 'hidden',
      }}
    >
      <div
        ref={gripRef}
        className={styles.grip}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="button"
        aria-label="Drag to resize answer buttons"
        aria-disabled={disabled}
      >
        <span className={styles.gripBar} />
        <span className={styles.gripBar} />
        <span className={styles.gripBar} />
      </div>

      <div
        ref={bodyRef}
        className={`${styles.body} ${atFull ? styles.scrollable : ''}`}
      >
        <div
          ref={buttonsRowRef}
          className={`${sharedStyles.actionCluster} ${styles.verdictRow}`}
        >
          {onCorrect && (
            <SlideOutActionButton
              variant="correct"
              sizeClass={verdictSize}
              name="correct_submit"
              value="Correct!"
              onClick={onCorrect}
              disabled={disabled}
              className={styles.correct}
            >
              Correct!
            </SlideOutActionButton>
          )}

          {onWrong && (
            <SlideOutActionButton
              variant="wrong"
              sizeClass={verdictSize}
              name="incorrect_submit"
              value="Wrong!"
              onClick={onWrong}
              disabled={disabled}
            >
              Wrong!
            </SlideOutActionButton>
          )}

          {onSlightlyWrong && (
            <SlideOutActionButton
              variant="slightlyWrong"
              sizeClass={verdictSize}
              name="incorrect_submit"
              value="Slightly Wrong"
              onClick={onSlightlyWrong}
              disabled={disabled}
            >
              Slightly Wrong
            </SlideOutActionButton>
          )}
        </div>

        {hasExtra && (
          <div ref={drawerRef} className={sharedStyles.actionCluster}>
            {(compactActions ?? []).map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={disabled}
                className={panelBtn(sharedStyles.btnCyan)}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}

            {author && (
              <AuthorButton
                author={author}
                disabled={disabled}
                className={panelBtn(sharedStyles.btnCyan)}
              />
            )}

            {(extraActions ?? []).map((action) => {
              const buttonClass = panelBtn(
                action.variant === 'exclude' ? sharedStyles.btnRed : sharedStyles.btnCyan,
              );

              if (action.href) {
                return (
                  <a
                    key={action.key}
                    href={disabled ? undefined : action.href}
                    aria-disabled={disabled}
                    className={buttonClass}
                    onClick={(e) => {
                      if (disabled) e.preventDefault();
                    }}
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </a>
                );
              }

              return (
                <button
                  key={action.key}
                  type={action.onClick ? 'button' : 'submit'}
                  name={action.submitName}
                  value={action.submitValue}
                  onClick={action.onClick}
                  disabled={disabled}
                  className={buttonClass}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              );
            })}

            {onToggleAudioEnabled && (
              <ToggleButton
                on={Boolean(audioEnabled)}
                disabled={disabled}
                onClick={onToggleAudioEnabled}
                label="Audio"
              />
            )}

            {/* Auto-play only means anything while audio is on, so it nests under it. */}
            {audioEnabled && onToggleAutoPlay && (
              <ToggleButton
                on={Boolean(autoPlay)}
                disabled={disabled}
                onClick={onToggleAutoPlay}
                label="Auto-Play"
              />
            )}

            {questionId && (
              <FlagButton
                questionId={questionId}
                initialFlag={initialFlag}
                csrfToken={csrfToken}
                onFlagChange={onFlagChange}
                disabled={disabled}
              />
            )}
          </div>
        )}

        {showCategories && (
          <div ref={categoriesRef}>
            <CategoriesSection
              categoryList={categoryList}
              initialSelectedCategories={initialSelectedCategories}
              onApply={onApplyCategories}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
});