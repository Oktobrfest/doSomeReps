import { createCategoryColorScale, extractSortedCategories } from "./categoryColors";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import type { DailyQuizStat } from "./home_types";
import sharedStyles from "../styles/shared.module.css";
import styles from "./DailyActivityChart.module.css";

interface DailyActivityChartProps {
  data: DailyQuizStat[];
}

type ChartMode = "usage" | "accuracy";
type Granularity = "daily" | "weekly";

interface ActivityItem {
  date: string;
  correct: Record<string, number>;
  incorrect: Record<string, number>;
  totalCorrect: number;
  totalIncorrect: number;
}

// Category colors shared via categoryColors.ts

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function formatDateLabel(dateStr: string): string {
  try {
    const { year, month, day } = parseDateParts(dateStr);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const { year, month, day } = parseDateParts(dateStr);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function getMonday(dateStr: string): string {
  const { year, month, day } = parseDateParts(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const diff = (dayOfWeek + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function getWeekRangeLabel(mondayStr: string): string {
  try {
    const { year, month, day } = parseDateParts(mondayStr);
    const mon = new Date(Date.UTC(year, month - 1, day));
    const sun = new Date(Date.UTC(year, month - 1, day + 6));
    const monLabel = mon.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
    const sunLabel = sun.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return `Week of ${monLabel} \u2013 ${sunLabel}`;
  } catch {
    return mondayStr;
  }
}

export function DailyActivityChart({ data }: DailyActivityChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(600);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [mode, setMode] = useState<ChartMode>("usage");
  const [zoom, setZoom] = useState<number>(1.0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(false);
  const [hoveredItem, setHoveredItem] = useState<ActivityItem | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<{ left: number; top: number } | null>(null);

  // Drag-to-pan state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Close legend dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setIsLegendExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Measure scroll area width to ensure full-width fill when few days
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  // Mouse wheel zoom: scrolling down zooms in, scrolling up zooms out!
  // Pinching on trackpad (wheel with ctrlKey) also zooms in/out!
  // Horizontal scroll (mouse tilt wheel, thumb wheel, trackpad horizontal swipe, Shift + wheel) scrolls the chart!
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // 1. Pinch-to-zoom on trackpad (ctrlKey or metaKey)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        setZoom((prev) => Math.min(4.5, Math.max(0.3, Number((prev * factor).toFixed(2)))));
        setHoveredItem(null);
        setAnchorPos(null);
      setTooltipCoords(null);
        return;
      }

      // 2. Shift + wheel: standard mouse horizontal scroll
      if (e.shiftKey) {
        e.preventDefault();
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const multiplier = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
        el.scrollLeft += delta * multiplier;
        setHoveredItem(null);
        setAnchorPos(null);
      setTooltipCoords(null);
        return;
      }

      // 3. Horizontal scroll (mouse tilt wheel, thumb wheel, or horizontal trackpad swipe)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) {
        // Let native horizontal scroll handle it on .scrollArea
        return;
      }

      // 4. Vertical scroll without modifier keys: zoom in / out
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.85;
      setZoom((prev) => Math.min(4.5, Math.max(0.3, Number((prev * factor).toFixed(2)))));
      setHoveredItem(null);
      setAnchorPos(null);
      setTooltipCoords(null);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Dismiss tooltip when either the chart or window scrolls or resizes
  useEffect(() => {
    const handleScroll = () => {
      setHoveredItem(null);
      setAnchorPos(null);
      setTooltipCoords(null);
    };

    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      if (scrollEl) {
        scrollEl.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Touch pinch-to-zoom on mobile / touch displays
  const touchDistRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDistRef.current;
      if (Math.abs(ratio - 1) > 0.04) {
        setZoom((prev) => Math.min(4.5, Math.max(0.3, Number((prev * ratio).toFixed(2)))));
        touchDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  // Drag to pan horizontally
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    setHoveredItem(null);
    setAnchorPos(null);
      setTooltipCoords(null);
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = x - startXRef.current;
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    setHoveredItem(null);
    setAnchorPos(null);
      setTooltipCoords(null);
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Sort daily data chronologically
  const sortedDailyData = useMemo(() => {
    return [...data].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Aggregate into weekly data (weeks starting on Monday)
  const weeklyData = useMemo(() => {
    const weekMap = new Map<string, ActivityItem>();

    for (const day of sortedDailyData) {
      const monday = getMonday(day.date);
      let entry = weekMap.get(monday);
      if (!entry) {
        entry = {
          date: monday,
          correct: {},
          incorrect: {},
          totalCorrect: 0,
          totalIncorrect: 0,
        };
        weekMap.set(monday, entry);
      }
      entry.totalCorrect += day.totalCorrect;
      entry.totalIncorrect += day.totalIncorrect;

      for (const [cat, cnt] of Object.entries(day.correct)) {
        entry.correct[cat] = (entry.correct[cat] || 0) + cnt;
      }
      for (const [cat, cnt] of Object.entries(day.incorrect)) {
        entry.incorrect[cat] = (entry.incorrect[cat] || 0) + cnt;
      }
    }

    return Array.from(weekMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sortedDailyData]);

  // Active dataset based on granularity
  const activeData: ActivityItem[] = granularity === "daily" ? sortedDailyData : weeklyData;

  // Auto-scroll to the latest items (far right) on mount / mode / granularity change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data, containerWidth, mode, granularity]);

  // Extract all categories across history, sorted by most to least commonly answered
  const sortedCategories = useMemo(() => {
    return extractSortedCategories(data);
  }, [data]);

  // Max visible categories in the upper-right corner without pushing down the chart
  const MAX_VISIBLE = 3;
  const visibleCategories = sortedCategories.slice(0, MAX_VISIBLE);
  const overflowCategories = sortedCategories.slice(MAX_VISIBLE);
  const hasOverflow = overflowCategories.length > 0;

  // Color scale mapping category names consistently to palette colors
  const colorScale = useMemo(() => {
    return createCategoryColorScale(sortedCategories);
  }, [sortedCategories]);

  // Quick summary aggregates
  const summary = useMemo(() => {
    let totalCorrect = 0;
    let totalIncorrect = 0;
    for (const d of data) {
      totalCorrect += d.totalCorrect;
      totalIncorrect += d.totalIncorrect;
    }
    const totalAnswered = totalCorrect + totalIncorrect;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    return {
      daysCount: sortedDailyData.length,
      weeksCount: weeklyData.length,
      totalCorrect,
      totalIncorrect,
      totalAnswered,
      accuracy,
    };
  }, [data, sortedDailyData, weeklyData]);

  if (data.length === 0) {
    return (
      <section className={styles.container}>
        <div className={styles.header}>
          <div className={styles.leftCol}>
            <div className={styles.titleArea}>
              <h3 className={styles.title}>Daily Quiz Activity</h3>
              <p className={styles.subtitle}>Daily questions answered over time</p>
            </div>
          </div>
        </div>
        <div className={styles.emptyState}>
          No quiz activity recorded yet. Take a quiz to begin tracking your progress!
        </div>
      </section>
    );
  }

  // Geometry
  const svgHeight = 320;
  const marginTop = 24;
  const marginBottom = 40;
  const yAxisWidth = 48;

  // Step width scaled by zoom: baseline is 46px for daily, 56px for weekly
  const baseStep = granularity === "daily" ? 46 : 56;
  const stepWidth = Math.max(14, Math.round(baseStep * zoom));
  const chartWidth = Math.max(containerWidth, activeData.length * stepWidth);

  const xScale = d3
    .scaleBand()
    .domain(activeData.map((d) => d.date))
    .range([0, chartWidth])
    .padding(0.32);

  const barWidth = xScale.bandwidth();

  // Dynamic Ticks and Labels: skip items when zoomed out to prevent text overlap
  const visibleTicks = useMemo(() => {
    if (activeData.length === 0) return [];

    const stepPx = xScale.step();
    const MIN_LABEL_DISTANCE = 46;

    if (stepPx >= MIN_LABEL_DISTANCE) {
      return activeData.map((it) => ({
        item: it,
        cx: (xScale(it.date) ?? 0) + barWidth / 2,
      }));
    }

    const result: { item: ActivityItem; cx: number }[] = [];
    let lastX = -Infinity;

    if (granularity === "daily") {
      const isVeryZoomedOut = stepPx < 24;

      for (let i = 0; i < activeData.length; i++) {
        const it = activeData[i];
        const { year, month, day } = parseDateParts(it.date);
        const date = new Date(Date.UTC(year, month - 1, day));
        const dayOfWeek = date.getUTCDay();

        // Candidates:
        // 1. Monday (dayOfWeek === 1)
        // 2. Or first day of that week in data if Monday wasn't recorded
        // 3. Or Thursday (dayOfWeek === 4) if not very zoomed out
        const prev = activeData[i - 1];
        const isFirstInWeek = !prev || getMonday(prev.date) !== getMonday(it.date);
        const isCandidate =
          isFirstInWeek ||
          dayOfWeek === 1 ||
          (!isVeryZoomedOut && dayOfWeek === 4);

        if (isCandidate) {
          const cx = (xScale(it.date) ?? 0) + barWidth / 2;
          if (cx - lastX >= MIN_LABEL_DISTANCE) {
            result.push({ item: it, cx });
            lastX = cx;
          }
        }
      }
    } else {
      // Weekly granularity
      const stride = Math.max(1, Math.ceil(MIN_LABEL_DISTANCE / stepPx));
      for (let i = 0; i < activeData.length; i += stride) {
        const it = activeData[i];
        const cx = (xScale(it.date) ?? 0) + barWidth / 2;
        result.push({ item: it, cx });
      }
    }

    // Safety fallback: ensure at least the first item is marked
    if (result.length === 0 && activeData.length > 0) {
      const it = activeData[0];
      result.push({ item: it, cx: (xScale(it.date) ?? 0) + barWidth / 2 });
    }

    return result;
  }, [activeData, xScale, barWidth, granularity]);

  // Scales & Ticks based on Mode
  let yScale: d3.ScaleLinear<number, number>;
  let yZero: number;
  let yTicks: number[];

  if (mode === "usage") {
    const maxTotal = Math.max(
      ...activeData.map((d) => d.totalCorrect + d.totalIncorrect),
      1
    );
    yScale = d3
      .scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([svgHeight - marginBottom, marginTop]);
    yZero = yScale(0);
    const rawTicks = yScale.ticks(Math.min(maxTotal + 1, 8));
    yTicks = Array.from(new Set(rawTicks.map((t) => Math.round(t)))).sort((a, b) => b - a);
  } else {
    // "accuracy" mode: correct positive, incorrect negative
    const maxCorrect = Math.max(...activeData.map((d) => d.totalCorrect), 1);
    const maxIncorrect = Math.max(...activeData.map((d) => d.totalIncorrect), 1);
    yScale = d3
      .scaleLinear()
      .domain([-maxIncorrect, maxCorrect])
      .nice()
      .range([svgHeight - marginBottom, marginTop]);
    yZero = yScale(0);
    const rawTicks = yScale.ticks(Math.min(maxCorrect + maxIncorrect + 1, 8));
    yTicks = Array.from(new Set(rawTicks.map((t) => Math.round(t)))).sort((a, b) => b - a);
  }

  const updateTooltipPosition = (event: React.MouseEvent<SVGElement>) => {
    if (!scrollRef.current) return;
    const scrollRect = scrollRef.current.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = Math.min(event.clientY, scrollRect.top + yZero);
    setAnchorPos({ x: clientX, y: clientY });
  };

  const handleBarMouseEnter = (item: ActivityItem, event: React.MouseEvent<SVGElement>) => {
    if (isDraggingRef.current) return;
    setHoveredItem(item);
    updateTooltipPosition(event);
  };

  const handleBarMouseMove = (event: React.MouseEvent<SVGElement>) => {
    if (isDraggingRef.current) return;
    updateTooltipPosition(event);
  };

  const handleBarMouseLeave = () => {
    setHoveredItem(null);
    setAnchorPos(null);
      setTooltipCoords(null);
  };

  const toggleCategory = (cat: string) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  };

  // Prepare table rows for tooltip for the hovered item
  const hoveredCategoryRows = useMemo(() => {
    if (!hoveredItem) return [];
    const catMap = new Map<string, { correct: number; incorrect: number; total: number }>();
    for (const [cat, count] of Object.entries(hoveredItem.correct)) {
      if (count > 0) {
        const it = catMap.get(cat) || { correct: 0, incorrect: 0, total: 0 };
        it.correct += count;
        it.total += count;
        catMap.set(cat, it);
      }
    }
    for (const [cat, count] of Object.entries(hoveredItem.incorrect)) {
      if (count > 0) {
        const it = catMap.get(cat) || { correct: 0, incorrect: 0, total: 0 };
        it.incorrect += count;
        it.total += count;
        catMap.set(cat, it);
      }
    }
    return Array.from(catMap.entries())
      .map(([name, stats]) => ({
        name,
        correct: stats.correct,
        incorrect: stats.incorrect,
        total: stats.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [hoveredItem]);

  const hoveredDayTotal = hoveredItem ? hoveredItem.totalCorrect + hoveredItem.totalIncorrect : 0;
  const hoveredDayAccuracy =
    hoveredItem && hoveredDayTotal > 0
      ? Math.round((hoveredItem.totalCorrect / hoveredDayTotal) * 100)
      : 0;

  useLayoutEffect(() => {
    if (!hoveredItem || !anchorPos || !tooltipRef.current) {
      setTooltipCoords(null);
      return;
    }

    const el = tooltipRef.current;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const PADDING = 12;
    const GAP = 10;

    // Center horizontally on anchor, strictly clamped within viewport padding
    let left = anchorPos.x - width / 2;
    left = Math.max(PADDING, Math.min(window.innerWidth - width - PADDING, left));

    // Prefer placing above cursor
    let top = anchorPos.y - height - GAP;
    if (top < PADDING) {
      // If above does not fit, check if placing below fits within viewport
      const belowTop = anchorPos.y + GAP + 14;
      if (belowTop + height <= window.innerHeight - PADDING) {
        top = belowTop;
      } else {
        // If neither fits fully, clamp so bottom of tooltip NEVER cuts off at viewport bottom
        top = Math.max(PADDING, window.innerHeight - height - PADDING);
      }
    }

    setTooltipCoords({ left, top });
  }, [hoveredItem, anchorPos, hoveredCategoryRows]);

  return (
    <section className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        {/* Left column: Title, subtitle, Granularity buttons, Mode buttons, Stats */}
        <div className={styles.leftCol}>
          <div className={styles.titleArea}>
            <h3 className={styles.title}>
              {granularity === "weekly" ? "Weekly Quiz Activity" : "Daily Quiz Activity"}
            </h3>
            <p className={styles.subtitle}>
              {granularity === "weekly"
                ? mode === "usage"
                  ? "Weekly questions answered by category (Mouse wheel zooms in/out, click & drag to scroll)"
                  : "Questions answered correct (above 0) and incorrect (below 0) each week"
                : mode === "usage"
                  ? "Daily questions answered by category (Mouse wheel zooms in/out, click & drag to scroll)"
                  : "Questions answered correct (above 0) and incorrect (below 0) each day"}
            </p>
          </div>

          <div className={styles.controlsRow}>
            {/* Granularity Option: Daily / Weekly */}
            <div className={styles.buttonGroup} role="tablist" aria-label="Chart granularity">
              <button
                type="button"
                role="tab"
                aria-selected={granularity === "daily"}
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                  granularity === "daily" ? sharedStyles.btnSlate : styles.btnInactive
                }`}
                onClick={() => setGranularity("daily")}
              >
                Daily
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={granularity === "weekly"}
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                  granularity === "weekly" ? sharedStyles.btnSlate : styles.btnInactive
                }`}
                onClick={() => setGranularity("weekly")}
              >
                Weekly
              </button>
            </div>

            {/* Mode Buttons */}
            <div className={styles.buttonGroup} role="tablist" aria-label="Chart mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "usage"}
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                  mode === "usage" ? sharedStyles.btnBlue : styles.btnInactive
                }`}
                onClick={() => setMode("usage")}
              >
                Usage
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "accuracy"}
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                  mode === "accuracy" ? sharedStyles.btnTeal : styles.btnInactive
                }`}
                onClick={() => setMode("accuracy")}
              >
                Accuracy
              </button>
            </div>

            {/* Zoom In / Out / Reset Controls */}
            <div className={styles.zoomControls} role="group" aria-label="Zoom controls">
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={() => setZoom((prev) => Math.max(0.3, Number((prev * 0.8).toFixed(2))))}
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className={styles.zoomResetBtn}
                onClick={() => setZoom(1.0)}
                title="Reset zoom to 100%"
                aria-label="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={() => setZoom((prev) => Math.min(4.5, Number((prev * 1.25).toFixed(2))))}
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>

            {/* Summary Badges */}
            <div className={styles.statsRow}>
              <span className={styles.statBadge}>
                {granularity === "weekly"
                  ? `${summary.weeksCount} active week${summary.weeksCount === 1 ? "" : "s"}`
                  : `${summary.daysCount} active day${summary.daysCount === 1 ? "" : "s"}`}
              </span>
              <span className={styles.statBadge}>
                {summary.totalAnswered} questions answered
              </span>
              {mode === "accuracy" && (
                <>
                  <span className={`${styles.statBadge} ${styles.statCorrect}`}>
                    +{summary.totalCorrect}
                  </span>
                  <span className={`${styles.statBadge} ${styles.statIncorrect}`}>
                    -{summary.totalIncorrect}
                  </span>
                  <span className={styles.statBadge}>{summary.accuracy}% acc</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Upper-right Single-Column Condensed Legend */}
        {sortedCategories.length > 0 && (
          <div className={styles.rightLegendCol} ref={legendRef}>
            {visibleCategories.map((cat) => {
              const color = colorScale(cat);
              const isActive = activeCategory === cat;
              const isDimmed = activeCategory !== null && !isActive;
              return (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.legendItem} ${isActive ? styles.legendItemActive : ""} ${
                    isDimmed ? styles.legendItemDimmed : ""
                  }`}
                  onClick={() => toggleCategory(cat)}
                  title={
                    isActive
                      ? `Click to clear filter on ${cat}`
                      : `Click to highlight ${cat} in graph`
                  }
                >
                  <span className={styles.legendSwatch} style={{ backgroundColor: color }} />
                  <span>{cat}</span>
                </button>
              );
            })}

            {hasOverflow && (
              <>
                <button
                  type="button"
                  className={styles.legendMoreBtn}
                  onClick={() => setIsLegendExpanded((prev) => !prev)}
                  title={`${overflowCategories.length} more categories`}
                >
                  ...
                </button>

                {isLegendExpanded && (
                  <div className={styles.legendDropdown}>
                    <div className={styles.legendDropdownTitle}>All Categories</div>
                    {sortedCategories.map((cat) => {
                      const color = colorScale(cat);
                      const isActive = activeCategory === cat;
                      const isDimmed = activeCategory !== null && !isActive;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`${styles.legendItem} ${
                            isActive ? styles.legendItemActive : ""
                          } ${isDimmed ? styles.legendItemDimmed : ""}`}
                          onClick={() => {
                            toggleCategory(cat);
                            setIsLegendExpanded(false);
                          }}
                        >
                          <span
                            className={styles.legendSwatch}
                            style={{ backgroundColor: color }}
                          />
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.graphLayout}>
        {/* Sticky Y-Axis on the left */}
        <div className={styles.yAxisSticky}>
          <svg width={yAxisWidth} height={svgHeight} aria-hidden="true">
            {yTicks.map((tick) => {
              const y = yScale(tick);
              const label =
                mode === "accuracy" && tick > 0
                  ? `+${tick}`
                  : `${tick}`;
              return (
                <g key={tick} transform={`translate(0, ${y})`}>
                  <line
                    x1={yAxisWidth - 6}
                    y1={0}
                    x2={yAxisWidth}
                    y2={0}
                    stroke="var(--rep-color-border-strong)"
                  />
                  <text x={yAxisWidth - 8} y={0} className={styles.yAxisText}>
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Horizontally scrollable chart with mouse wheel zoom & click-drag panning */}
        <div
          className={styles.scrollArea}
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMovePan}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <svg
            className={styles.chartSvg}
            width={chartWidth}
            height={svgHeight}
            role="img"
            aria-label="Quiz activity bar chart"
          >
            {/* Horizontal Grid lines */}
            {yTicks.map((tick) => {
              if (tick === 0 && mode === "accuracy") return null;
              const y = yScale(tick);
              return (
                <line
                  key={tick}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  className={styles.gridLine}
                />
              );
            })}

            {/* Zero baseline */}
            <line
              x1={0}
              y1={yZero}
              x2={chartWidth}
              y2={yZero}
              className={styles.zeroLine}
            />

            {/* Axis baseline at bottom of chart */}
            <line
              x1={0}
              y1={svgHeight - marginBottom}
              x2={chartWidth}
              y2={svgHeight - marginBottom}
              className={styles.axisBaseline}
            />

            {/* Bars for each day / week */}
            {activeData.map((item) => {
              const x = xScale(item.date) ?? 0;
              const dayTotal = item.totalCorrect + item.totalIncorrect;

              if (mode === "usage") {
                // Stack all questions for the item upwards from 0
                let currentY = 0;
                const totalSegments: {
                  category: string;
                  count: number;
                  y: number;
                  height: number;
                }[] = [];

                for (const cat of sortedCategories) {
                  const catCount = (item.correct[cat] || 0) + (item.incorrect[cat] || 0);
                  if (catCount <= 0) continue;
                  const segTop = yScale(currentY + catCount);
                  const segBottom = yScale(currentY);
                  const segHeight = Math.max(segBottom - segTop, 0.5);
                  totalSegments.push({
                    category: cat,
                    count: catCount,
                    y: segTop,
                    height: segHeight,
                  });
                  currentY += catCount;
                }

                const totalTop = yScale(dayTotal);

                return (
                  <g key={item.date} className={styles.dayGroup}>
                    {totalSegments.map((seg) => {
                      const color = colorScale(seg.category);
                      const isDimmed =
                        activeCategory !== null && activeCategory !== seg.category;
                      return (
                        <rect
                          key={`t-${seg.category}`}
                          x={x}
                          y={seg.y}
                          width={barWidth}
                          height={seg.height}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={0.5}
                          className={`${styles.segment} ${
                            isDimmed ? styles.segmentDimmed : ""
                          }`}
                        />
                      );
                    })}

                    {dayTotal > 0 && barWidth >= 16 && (
                      <text
                        x={x + barWidth / 2}
                        y={totalTop - 4}
                        className={`${styles.barValueLabel} ${styles.barValueTotal}`}
                      >
                        {dayTotal}
                      </text>
                    )}

                    <rect
                      x={x - 2}
                      y={marginTop}
                      width={barWidth + 4}
                      height={svgHeight - marginTop - marginBottom}
                      className={styles.dayColumnHit}
                      onMouseEnter={(e) => handleBarMouseEnter(item, e)}
                      onMouseMove={handleBarMouseMove}
                      onMouseLeave={handleBarMouseLeave}
                    />
                  </g>
                );
              }

              // "accuracy" mode: correct positive, incorrect negative
              let currentCorrectY = 0;
              const correctSegments: {
                category: string;
                count: number;
                y: number;
                height: number;
              }[] = [];

              for (const [cat, count] of Object.entries(item.correct)) {
                if (count <= 0) continue;
                const segTop = yScale(currentCorrectY + count);
                const segBottom = yScale(currentCorrectY);
                const segHeight = Math.max(segBottom - segTop, 0.5);
                correctSegments.push({
                  category: cat,
                  count,
                  y: segTop,
                  height: segHeight,
                });
                currentCorrectY += count;
              }

              let currentIncorrectY = 0;
              const incorrectSegments: {
                category: string;
                count: number;
                y: number;
                height: number;
              }[] = [];

              for (const [cat, count] of Object.entries(item.incorrect)) {
                if (count <= 0) continue;
                const segTop = yScale(-currentIncorrectY);
                const segBottom = yScale(-(currentIncorrectY + count));
                const segHeight = Math.max(segBottom - segTop, 0.5);
                incorrectSegments.push({
                  category: cat,
                  count,
                  y: segTop,
                  height: segHeight,
                });
                currentIncorrectY += count;
              }

              const totalCorrectTop = yScale(item.totalCorrect);
              const totalIncorrectBottom = yScale(-item.totalIncorrect);

              return (
                <g key={item.date} className={styles.dayGroup}>
                  {correctSegments.map((seg) => {
                    const color = colorScale(seg.category);
                    const isDimmed =
                      activeCategory !== null && activeCategory !== seg.category;
                    return (
                      <rect
                        key={`c-${seg.category}`}
                        x={x}
                        y={seg.y}
                        width={barWidth}
                        height={seg.height}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={0.5}
                        className={`${styles.segment} ${
                          isDimmed ? styles.segmentDimmed : ""
                        }`}
                      />
                    );
                  })}

                  {incorrectSegments.map((seg) => {
                    const color = colorScale(seg.category);
                    const isDimmed =
                      activeCategory !== null && activeCategory !== seg.category;
                    return (
                      <rect
                        key={`i-${seg.category}`}
                        x={x}
                        y={seg.y}
                        width={barWidth}
                        height={seg.height}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={0.5}
                        className={`${styles.segment} ${
                          isDimmed ? styles.segmentDimmed : ""
                        }`}
                      />
                    );
                  })}

                  {item.totalCorrect > 0 && barWidth >= 16 && (
                    <text
                      x={x + barWidth / 2}
                      y={totalCorrectTop - 4}
                      className={`${styles.barValueLabel} ${styles.barValueCorrect}`}
                    >
                      +{item.totalCorrect}
                    </text>
                  )}
                  {item.totalIncorrect > 0 && barWidth >= 16 && (
                    <text
                      x={x + barWidth / 2}
                      y={totalIncorrectBottom + 11}
                      className={`${styles.barValueLabel} ${styles.barValueIncorrect}`}
                    >
                      -{item.totalIncorrect}
                    </text>
                  )}

                  <rect
                    x={x - 2}
                    y={marginTop}
                    width={barWidth + 4}
                    height={svgHeight - marginTop - marginBottom}
                    className={styles.dayColumnHit}
                    onMouseEnter={(e) => handleBarMouseEnter(item, e)}
                    onMouseMove={handleBarMouseMove}
                    onMouseLeave={handleBarMouseLeave}
                  />
                </g>
              );
            })}

            {/* X-Axis Ticks & Labels: carefully spaced so they never overlap */}
            {visibleTicks.map(({ item, cx }) => (
              <g key={`tick-${item.date}`} className={styles.tickGroup}>
                <line
                  x1={cx}
                  y1={svgHeight - marginBottom}
                  x2={cx}
                  y2={svgHeight - marginBottom + 5}
                  className={styles.tickLine}
                />
                <text
                  x={cx}
                  y={svgHeight - marginBottom + 18}
                  className={styles.xAxisText}
                >
                  {formatDateLabel(item.date)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Floating Tooltip rendered via portal, strictly clamped so bottom or top never truncate */}
      {hoveredItem &&
        createPortal(
          <div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{
              left: tooltipCoords ? `${tooltipCoords.left}px` : "-9999px",
              top: tooltipCoords ? `${tooltipCoords.top}px` : "-9999px",
              visibility: tooltipCoords ? "visible" : "hidden",
            }}
          >
            <div className={styles.tooltipDate}>
              {granularity === "weekly"
                ? getWeekRangeLabel(hoveredItem.date)
                : formatFullDate(hoveredItem.date)}
            </div>

            {mode === "accuracy" ? (
              <>
                <div className={styles.tooltipSummary}>
                  <span className={styles.statCorrect}>
                    +{hoveredItem.totalCorrect} Correct
                  </span>
                  <span className={styles.statIncorrect}>
                    -{hoveredItem.totalIncorrect} Incorrect
                  </span>
                  <span>{hoveredDayAccuracy}% acc</span>
                </div>

                {hoveredCategoryRows.length > 0 && (
                  <table className={styles.tooltipTable}>
                    <thead>
                      <tr>
                        <th className={styles.thCat}>Category</th>
                        <th className={styles.thNum}>Correct</th>
                        <th className={styles.thNum}>Incorrect</th>
                        <th className={styles.thNum}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hoveredCategoryRows.map((row) => (
                        <tr key={row.name}>
                          <td className={styles.tdCat}>
                            <div className={styles.tdCatContent}>
                              <span
                                className={styles.legendSwatch}
                                style={{ backgroundColor: colorScale(row.name) }}
                              />
                              <span title={row.name}>{row.name}</span>
                            </div>
                          </td>
                          <td className={`${styles.tdNum} ${styles.statCorrect}`}>
                            {row.correct > 0 ? `+${row.correct}` : "0"}
                          </td>
                          <td className={`${styles.tdNum} ${styles.statIncorrect}`}>
                            {row.incorrect > 0 ? `-${row.incorrect}` : "0"}
                          </td>
                          <td className={`${styles.tdNum} ${styles.tdTotal}`}>
                            {row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              /* Default "Usage" mode tooltip: NO % CORRECT */
              <>
                <div className={styles.tooltipSummary}>
                  <span className={styles.tdTotal}>{hoveredDayTotal} Questions Answered</span>
                </div>

                {hoveredCategoryRows.length > 0 && (
                  <table className={styles.tooltipTable}>
                    <thead>
                      <tr>
                        <th className={styles.thCat}>Category</th>
                        <th className={styles.thNum}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hoveredCategoryRows.map((row) => (
                        <tr key={row.name}>
                          <td className={styles.tdCat}>
                            <div className={styles.tdCatContent}>
                              <span
                                className={styles.legendSwatch}
                                style={{ backgroundColor: colorScale(row.name) }}
                              />
                              <span title={row.name}>{row.name}</span>
                            </div>
                          </td>
                          <td className={`${styles.tdNum} ${styles.tdTotal}`}>
                            {row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </section>
  );
}
