import { useLayoutEffect, useReducer, useState, type RefObject } from "react";

/** The narrowest a card may be; the grid has as many columns as fit that. */
const CARD_MIN_WIDTH_REM = 20;

/** How many columns the grid has, and how many of its rows fit on the screen. */
export interface GridShape {
  cols: number;
  maxRows: number;
}

/** How many grid cells a card covers, across and down. */
export interface Span {
  cols: number;
  rows: number;
}

const CLOSED: Span = { cols: 1, rows: 1 };

/** An open card starts one row deep: a short question and answer need no more. */
const OPENED: Span = { cols: 1, rows: 2 };

/**
 * The grid's shape, measured. The column count is decided here rather than by
 * `auto-fill`: a card spanning more columns than the grid has would add columns
 * of its own, and the grid would read them back as room it really has.
 */
export function useGridShape(grid: RefObject<HTMLElement>): GridShape {
  const [shape, setShape] = useState<GridShape>({ cols: 1, maxRows: OPENED.rows });

  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const colGap = parseFloat(style.columnGap);
      const rowGap = parseFloat(style.rowGap);
      const rowHeight = parseFloat(style.gridAutoRows);

      const cols = Math.max(
        1,
        Math.floor((el.clientWidth + colGap) / (CARD_MIN_WIDTH_REM * rem + colGap))
      );
      const maxRows = Math.max(
        OPENED.rows,
        Math.floor((window.innerHeight + rowGap) / (rowHeight + rowGap))
      );

      setShape((prev) =>
        prev.cols === cols && prev.maxRows === maxRows ? prev : { cols, maxRows }
      );
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

  return shape;
}

/** However much it holds, a card covers no more cells than this. */
const MAX_CELLS = 4;

/**
 * The next size to try: square it up, then grow a row taller, and only grow
 * wider once the screen has no more height to give.
 */
function grow({ cols, rows }: Span, shape: GridShape): Span | null {
  const next =
    rows > cols && cols < shape.cols ? { cols: cols + 1, rows }
    : rows < shape.maxRows ? { cols, rows: rows + 1 }
    : cols < shape.cols ? { cols: cols + 1, rows }
    : null;

  return next && next.cols * next.rows <= MAX_CELLS ? next : null;
}

/**
 * The cells an open card needs for everything in `body` to show. Every size is
 * laid out and measured before the screen is painted, so the card settles on
 * the first one that fits; past the largest the grid allows, `body` scrolls.
 */
export function useFitSpan(
  open: boolean,
  body: RefObject<HTMLElement>,
  shape: GridShape
): Span {
  const [span, setSpan] = useState<Span>(CLOSED);
  const [contentResized, onContentResize] = useReducer((n: number) => n + 1, 0);

  // Opened, closed or given a different grid, the card starts over.
  useLayoutEffect(() => setSpan(open ? OPENED : CLOSED), [open, shape]);

  // Images and diagrams arrive after the first fit, and are fitted again.
  useLayoutEffect(() => {
    const el = body.current;
    if (!open || !el) return;

    const observer = new ResizeObserver(onContentResize);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [open, body]);

  useLayoutEffect(() => {
    const el = body.current;
    if (!open || !el || el.scrollHeight - el.clientHeight <= 1) return;

    const next = grow(span, shape);
    if (next) setSpan(next);
  }, [open, span, shape, contentResized, body]);

  return span;
}
