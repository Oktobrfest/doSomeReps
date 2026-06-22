import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ButtonHTMLAttributes,
  type ReactNode,
  type PointerEvent,
} from 'react';
import { Check, X, Minus } from 'lucide-react';
import { CatPicker } from '../components/CatPicker';
import actionStyles from './ActionButton.module.css';
import styles from './SlideOutButtons.module.css';

interface SlideOutActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'correct' | 'wrong' | 'slightlyWrong';
}

function SlideOutActionButton({ variant, className, children, ...props }: SlideOutActionButtonProps) {
  const variantClass =
    variant === 'correct'
      ? actionStyles.greenBtn
      : variant === 'wrong'
        ? actionStyles.redBtn
        : actionStyles.orangeBtn;

  return (
    <button type="button" className={`${styles.btn} ${variantClass} ${className || ''}`} {...props}>
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

export interface SlideOutButtonsProps {
  className?: string;
  size?: 'default' | 'compact';
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
  extraActions?: ExtraAction[];
  /** Called whenever the visible panel height changes (in px). */
  onHeightChange?: (height: number) => void;
  /** If true, the panel mounts fully-collapsed and animates open to the answer-button trio. */
  expandToTrio?: boolean;
  /** Embed the category picker at the very bottom of the panel. */
  showCategories?: boolean;
  /** All category names, used to normalise initial selection slugs. */
  categoryList?: string[];
  /** Initial selected category values (may be slugs or full names). */
  initialSelectedCategories?: string[];
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
}: {
  categoryList?: string[];
  initialSelectedCategories?: string[];
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
      >
        Apply Categories
      </button>
      {selected.map((cat) => (
        <input key={cat} type="hidden" name="category_name" value={cat} />
      ))}
    </div>
  );
}

export function SlideOutButtons({
  className,
  size = 'default',
  onCorrect,
  onWrong,
  onSlightlyWrong,
  extraActions,
  onHeightChange,
  expandToTrio = false,
  showCategories = false,
  categoryList,
  initialSelectedCategories,
}: SlideOutButtonsProps) {
  const hasExtra = extraActions && extraActions.length > 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLDivElement | null>(null);
  const buttonsRowRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const autoExpanded = useRef(false);

  // Gesture tracking (refs so event handlers always see current values)
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
    const padBottom = parseFloat(panelStyle.paddingBottom) || 0;
    const gap = parseFloat(panelStyle.gap) || 0;

    const collapsed = grip.offsetHeight + padBottom;
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

  // Measure on mount and whenever the underlying content changes size.
  useEffect(() => {
    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const targets = [gripRef.current, buttonsRowRef.current, drawerRef.current, categoriesRef.current].filter(
      Boolean,
    ) as Element[];

    const ro = new ResizeObserver(measure);
    targets.forEach((el) => ro.observe(el));

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [measure, showCategories, hasExtra]);

  // Clamp current height into the new bounds whenever metrics change.
  useEffect(() => {
    if (!metrics) return;
    setCurrentHeight((prev) => {
      if (prev == null) return metrics.collapsed;
      return Math.max(metrics.collapsed, Math.min(prev, metrics.full));
    });
  }, [metrics]);

  // Expand from fully-collapsed up to the trio height when requested.
  useEffect(() => {
    if (expandToTrio && metrics && currentHeight === metrics.collapsed && !autoExpanded.current) {
      autoExpanded.current = true;
      requestAnimationFrame(() => {
        setCurrentHeight(metrics.trio);
      });
    }
  }, [expandToTrio, metrics, currentHeight]);

  // Report the target visible height back to the parent.
  // During dragging we skip it to avoid layout thrashing; the parent will catch up on release.
  useEffect(() => {
    if (isDragging || currentHeight == null) return;
    onHeightChange?.(currentHeight);
  }, [currentHeight, isDragging, onHeightChange]);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!metrics || !gripRef.current || e.button !== 0) return;
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      hasDragged.current = false;
      startY.current = e.clientY;
      startHeight.current = currentHeight ?? metrics.collapsed;
      try {
        gripRef.current.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [currentHeight, metrics],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !metrics) return;
      const deltaY = startY.current - e.clientY;
      if (Math.abs(deltaY) > 4) hasDragged.current = true;
      const next = Math.max(metrics.collapsed, Math.min(startHeight.current + deltaY, metrics.full));
      setCurrentHeight(next);
    },
    [metrics],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current || !metrics) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (!hasDragged.current) {
      // Clean tap: toggle based on the panel height when the press started.
      // This avoids any stale state/closure issues.
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
      >
        <span className={styles.gripBar} />
        <span className={styles.gripBar} />
        <span className={styles.gripBar} />
      </div>

      <div ref={buttonsRowRef} className={styles.buttonsRow}>
        {onCorrect && (
          <SlideOutActionButton variant="correct" onClick={onCorrect} className={styles.correct}>
            Correct!
          </SlideOutActionButton>
        )}
        {onWrong && (
          <SlideOutActionButton variant="wrong" onClick={onWrong} className={styles.secondary}>
            Wrong!
          </SlideOutActionButton>
        )}
        {onSlightlyWrong && (
          <SlideOutActionButton variant="slightlyWrong" onClick={onSlightlyWrong} className={styles.secondary}>
            Slightly Wrong
          </SlideOutActionButton>
        )}
      </div>

      {hasExtra && (
        <div ref={drawerRef} className={styles.drawer}>
          {extraActions.map((action) => {
            const className = `${styles.drawerBtn} ${
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
                  href={action.href}
                  className={className}
                  style={{ textDecoration: 'none' }}
                >
                  {content}
                </a>
              );
            }
            return (
              <button
                key={action.key}
                type="submit"
                name={action.submitName}
                value={action.submitValue}
                className={className}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}

      {showCategories && (
        <div ref={categoriesRef}>
          <CategoriesSection
            categoryList={categoryList}
            initialSelectedCategories={initialSelectedCategories}
          />
        </div>
      )}
    </div>
  );
}
