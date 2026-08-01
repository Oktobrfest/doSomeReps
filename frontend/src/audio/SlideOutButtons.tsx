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
import { CatPicker } from '../components/CatPicker';
import { FlagButton, type QuestionFlag } from '../components/FlagButton';
import actionStyles from './ActionButton.module.css';
import styles from './SlideOutButtons.module.css';

interface SlideOutActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'correct' | 'wrong' | 'slightlyWrong';
}

function SlideOutActionButton({
  variant,
  className,
  children,
  ...props
}: SlideOutActionButtonProps) {
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
  onClick?: () => void;
}

export interface SlideOutButtonsProps {
  className?: string;
  size?: 'default' | 'compact';
  disabled?: boolean;
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
  extraActions?: ExtraAction[];
  onSnapChange?: (snap: 'collapsed' | 'trio' | 'full') => void;
  expandToTrio?: boolean;
  showCategories?: boolean;
  categoryList?: string[];
  initialSelectedCategories?: string[];
  questionId?: string | number;
  initialFlag?: QuestionFlag | null;
  csrfToken?: string;
  onFlagChange?: (newFlag: QuestionFlag | null) => void;
}

export interface SlideOutButtonsHandle {
  /** Snap the panel back to the collapsed position. */
  collapse: () => void;
}

interface Metrics {
  collapsed: number;
  trio: number;
  full: number;
}

function normaliseCategories(initial?: string[], all?: string[]) {
  if (!initial) return [];

  const known = new Set(all ?? []);

  return initial.map((raw) => {
    if (known.has(raw)) return raw;

    const decoded = raw.replace(/_/g, ' ');
    if (known.has(decoded)) return decoded;

    return decoded;
  });
}

function CategoriesSection({
  categoryList,
  initialSelectedCategories,
  disabled = false,
}: {
  categoryList?: string[];
  initialSelectedCategories?: string[];
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    normaliseCategories(initialSelectedCategories, categoryList),
  );

  return (
    <div className={styles.categoriesSection}>
      <CatPicker selectedCategories={selected} onChange={setSelected} />

      <button
        type="submit"
        name="apply-categories"
        value="Apply"
        className={styles.applyBtn}
        disabled={disabled}
      >
        Apply Categories
      </button>

      {selected.map((cat) => (
        <input key={cat} type="hidden" name="category_name" value={cat} />
      ))}
    </div>
  );
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
    onSnapChange,
    expandToTrio = false,
    showCategories = false,
    categoryList,
    initialSelectedCategories,
    questionId,
    initialFlag,
    csrfToken,
    onFlagChange,
  }: SlideOutButtonsProps,
  ref,
) {
  const hasExtra = Boolean(extraActions?.length) || Boolean(questionId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
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
    const buttons = buttonsRowRef.current;

    if (!panel || !grip || !buttons) return;

    const panelStyle = getComputedStyle(panel);
    const padTop = parseFloat(panelStyle.paddingTop) || 0;
    const padBottom = parseFloat(panelStyle.paddingBottom) || 0;
    const gap = parseFloat(panelStyle.gap) || 0;

    const collapsed = padTop + grip.offsetHeight + padBottom;
    let trio = collapsed + gap + buttons.offsetHeight;
    let full = trio;

    if (drawerRef.current) {
      full += gap + drawerRef.current.offsetHeight;
    }

    if (categoriesRef.current) {
      full += gap + categoriesRef.current.offsetHeight;
    }

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

  const containerClasses = [
    styles.container,
    size === 'compact' ? styles.sizeCompact : '',
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

      <div ref={buttonsRowRef} className={styles.buttonsRow}>
        {onCorrect && (
          <SlideOutActionButton
            variant="correct"
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
            name="incorrect_submit"
            value="Wrong!"
            onClick={onWrong}
            disabled={disabled}
            className={styles.secondary}
          >
            Wrong!
          </SlideOutActionButton>
        )}

        {onSlightlyWrong && (
          <SlideOutActionButton
            variant="slightlyWrong"
            name="incorrect_submit"
            value="Slightly Wrong"
            onClick={onSlightlyWrong}
            disabled={disabled}
            className={styles.secondary}
          >
            Slightly Wrong
          </SlideOutActionButton>
        )}
      </div>

      {hasExtra && (
        <div ref={drawerRef} className={styles.drawer}>
          {extraActions!.map((action) => {
            const drawerClassName = `${styles.drawerBtn} ${
              action.variant === 'exclude' ? actionStyles.redBtn : actionStyles.cyanBtn
            }`;

            const content = (
              <div className={actionStyles.btnContent}>
                {action.icon}
                <span>{action.label}</span>
              </div>
            );

            if (action.href) {
              return (
                <a
                  key={action.key}
                  href={disabled ? undefined : action.href}
                  aria-disabled={disabled}
                  className={drawerClassName}
                  style={{ textDecoration: 'none' }}
                  onClick={(e) => {
                    if (disabled) e.preventDefault();
                  }}
                >
                  {content}
                </a>
              );
            }

            if (action.onClick) {
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  disabled={disabled}
                  className={drawerClassName}
                >
                  {content}
                </button>
              );
            }

            return (
              <button
                key={action.key}
                type="submit"
                name={action.submitName}
                value={action.submitValue}
                disabled={disabled}
                className={drawerClassName}
              >
                {content}
              </button>
            );
          })}
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
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
});