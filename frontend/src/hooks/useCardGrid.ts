import { useLayoutEffect, useState, type RefObject } from "react";

/** The narrowest a card may be; the grid has as many columns as fit that. */
const CARD_MIN_WIDTH_REM = 20;

/**
 * The grid's shape, measured. The column count is decided here rather than by
 * `auto-fill`: a card spanning more columns than the grid has would add columns
 * of its own, and the grid would read them back as room it really has.
 */
export function useGridColumns(grid: RefObject<HTMLElement>): number {
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const colGap = parseFloat(style.columnGap);

      const cols = Math.max(
        1,
        Math.floor((el.clientWidth + colGap) / (CARD_MIN_WIDTH_REM * rem + colGap))
      );
      setColumns(cols);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [grid]);

  return columns;
}
