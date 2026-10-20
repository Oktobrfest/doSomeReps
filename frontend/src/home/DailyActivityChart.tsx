import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { DailyQuizStat } from "./home_types";
import sharedStyles from "../styles/shared.module.css";
import styles from "./DailyActivityChart.module.css";

interface DailyActivityChartProps {
  data: DailyQuizStat[];
}

type ChartMode = "usage" | "accuracy";

const COLOR_PALETTE = [
  ...d3.schemeTableau10,
  ...d3.schemePaired,
  ...d3.schemeSet3,
];

function formatDateLabel(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function DailyActivityChart({ data }: DailyActivityChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(600);
  const [mode, setMode] = useState<ChartMode>("usage");
  const [zoom, setZoom] = useState<number>(1.0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(false);
  const [hoveredDay, setHoveredDay] = useState<DailyQuizStat | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

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
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch gesture:
        // pinch out: deltaY < 0 -> zoom in
        // pinch in:  deltaY > 0 -> zoom out
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        setZoom((prev) => Math.min(4.5, Math.max(0.3, Number((prev * factor).toFixed(2)))));
      } else {
        // Direct mouse wheel:
        // Scrolling down zooms in, scrolling up zooms out!
        const factor = e.deltaY > 0 ? 1.15 : 0.85;
        setZoom((prev) => Math.min(4.5, Math.max(0.3, Number((prev * factor).toFixed(2)))));
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
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
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = x - startXRef.current;
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Auto-scroll to the latest days (far right) on mount / mode change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data, containerWidth, mode]);

  // Extract all categories across history, sorted by most to least commonly answered
  const sortedCategories = useMemo(() => {
    const tally = new Map<string, number>();
    for (const d of data) {
      for (const [c, count] of Object.entries(d.correct)) {
        tally.set(c, (tally.get(c) || 0) + count);
      }
      for (const [c, count] of Object.entries(d.incorrect)) {
        tally.set(c, (tally.get(c) || 0) + count);
      }
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1]) // most to least answered
      .map(([cat]) => cat);
  }, [data]);

  // Max visible categories in the upper-right corner without pushing down the chart
  const MAX_VISIBLE = 3;
  const visibleCategories = sortedCategories.slice(0, MAX_VISIBLE);
  const overflowCategories = sortedCategories.slice(MAX_VISIBLE);
  const hasOverflow = overflowCategories.length > 0;

  // Color scale mapping category names consistently to palette colors
  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<string, string>().domain(sortedCategories).range(COLOR_PALETTE);
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
      daysCount: data.length,
      totalCorrect,
      totalIncorrect,
      totalAnswered,
      accuracy,
    };
  }, [data]);

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
          No quiz activity recorded yet. Take a quiz to begin tracking your daily progress!
        </div>
      </section>
    );
  }

  // Geometry
  const svgHeight = 320;
  const marginTop = 24;
  const marginBottom = 40;
  const yAxisWidth = 48;

  // Day step width scaled by zoom: baseline is 46px
  const baseStep = 46;
  const stepWidth = Math.max(14, Math.round(baseStep * zoom));
  const chartWidth = Math.max(containerWidth, data.length * stepWidth);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.date))
    .range([0, chartWidth])
    .padding(0.32);

  const barWidth = xScale.bandwidth();

  // Scales & Ticks based on Mode
  let yScale: d3.ScaleLinear<number, number>;
  let yZero: number;
  let yTicks: number[];

  if (mode === "usage") {
    const maxTotal = Math.max(
      ...data.map((d) => d.totalCorrect + d.totalIncorrect),
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
    const maxCorrect = Math.max(...data.map((d) => d.totalCorrect), 1);
    const maxIncorrect = Math.max(...data.map((d) => d.totalIncorrect), 1);
    yScale = d3
      .scaleLinear()
      .domain([-maxIncorrect, maxCorrect])
      .nice()
      .range([svgHeight - marginBottom, marginTop]);
    yZero = yScale(0);
    const rawTicks = yScale.ticks(Math.min(maxCorrect + maxIncorrect + 1, 8));
    yTicks = Array.from(new Set(rawTicks.map((t) => Math.round(t)))).sort((a, b) => b - a);
  }

  const handleBarMouseEnter = (day: DailyQuizStat, event: React.MouseEvent<SVGElement>) => {
    if (isDraggingRef.current) return;
    setHoveredDay(day);
    if (scrollRef.current) {
      const scrollRect = scrollRef.current.getBoundingClientRect();
      const x = event.clientX - scrollRect.left + scrollRef.current.scrollLeft;
      const y = Math.min(event.clientY - scrollRect.top, yZero);
      setTooltipPos({ x, y });
    }
  };

  const handleBarMouseMove = (event: React.MouseEvent<SVGElement>) => {
    if (isDraggingRef.current) return;
    if (scrollRef.current) {
      const scrollRect = scrollRef.current.getBoundingClientRect();
      const x = event.clientX - scrollRect.left + scrollRef.current.scrollLeft;
      const y = Math.min(event.clientY - scrollRect.top, yZero);
      setTooltipPos({ x, y });
    }
  };

  const handleBarMouseLeave = () => {
    setHoveredDay(null);
    setTooltipPos(null);
  };

  const toggleCategory = (cat: string) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  };

  // Prepare table rows for tooltip for the hovered day
  const hoveredCategoryRows = useMemo(() => {
    if (!hoveredDay) return [];
    const catMap = new Map<string, { correct: number; incorrect: number; total: number }>();
    for (const [cat, count] of Object.entries(hoveredDay.correct)) {
      if (count > 0) {
        const item = catMap.get(cat) || { correct: 0, incorrect: 0, total: 0 };
        item.correct += count;
        item.total += count;
        catMap.set(cat, item);
      }
    }
    for (const [cat, count] of Object.entries(hoveredDay.incorrect)) {
      if (count > 0) {
        const item = catMap.get(cat) || { correct: 0, incorrect: 0, total: 0 };
        item.incorrect += count;
        item.total += count;
        catMap.set(cat, item);
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
  }, [hoveredDay]);

  const hoveredDayTotal = hoveredDay ? hoveredDay.totalCorrect + hoveredDay.totalIncorrect : 0;
  const hoveredDayAccuracy =
    hoveredDay && hoveredDayTotal > 0
      ? Math.round((hoveredDay.totalCorrect / hoveredDayTotal) * 100)
      : 0;

  return (
    <section className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        {/* Left column: Title, subtitle, colored mode buttons, stats */}
        <div className={styles.leftCol}>
          <div className={styles.titleArea}>
            <h3 className={styles.title}>Daily Quiz Activity</h3>
            <p className={styles.subtitle}>
              {mode === "usage"
                ? "Daily questions answered by category (Mouse wheel zooms in/out, click & drag to scroll)"
                : "Questions answered correct (above 0) and incorrect (below 0) each day"}
            </p>
          </div>

          <div className={styles.controlsRow}>
            {/* Colored Mode Buttons using existing shared button code */}
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

            {/* Quick Summary Badges: NO % in default Usage view! */}
            <div className={styles.statsRow}>
              <span className={styles.statBadge}>{summary.daysCount} active days</span>
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

        {/* Upper-right Single-Column Condensed Legend (max 3-5 categories, 2px margins/paddings, '...' expander) */}
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
            aria-label="Daily quiz activity bar chart"
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

            {/* Bars for each day */}
            {data.map((day) => {
              const x = xScale(day.date) ?? 0;
              const dayTotal = day.totalCorrect + day.totalIncorrect;

              if (mode === "usage") {
                // Stack all questions for the day upwards from 0
                let currentY = 0;
                const totalSegments: {
                  category: string;
                  count: number;
                  y: number;
                  height: number;
                }[] = [];

                for (const cat of sortedCategories) {
                  const catCount = (day.correct[cat] || 0) + (day.incorrect[cat] || 0);
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
                  <g key={day.date} className={styles.dayGroup}>
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

                    {dayTotal > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={totalTop - 4}
                        className={`${styles.barValueLabel} ${styles.barValueTotal}`}
                      >
                        {dayTotal}
                      </text>
                    )}

                    <text
                      x={x + barWidth / 2}
                      y={svgHeight - marginBottom + 16}
                      className={styles.xAxisText}
                    >
                      {formatDateLabel(day.date)}
                    </text>

                    <rect
                      x={x - 2}
                      y={marginTop}
                      width={barWidth + 4}
                      height={svgHeight - marginTop - marginBottom}
                      className={styles.dayColumnHit}
                      onMouseEnter={(e) => handleBarMouseEnter(day, e)}
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

              for (const [cat, count] of Object.entries(day.correct)) {
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

              for (const [cat, count] of Object.entries(day.incorrect)) {
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

              const totalCorrectTop = yScale(day.totalCorrect);
              const totalIncorrectBottom = yScale(-day.totalIncorrect);

              return (
                <g key={day.date} className={styles.dayGroup}>
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

                  {day.totalCorrect > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={totalCorrectTop - 4}
                      className={`${styles.barValueLabel} ${styles.barValueCorrect}`}
                    >
                      +{day.totalCorrect}
                    </text>
                  )}
                  {day.totalIncorrect > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={totalIncorrectBottom + 11}
                      className={`${styles.barValueLabel} ${styles.barValueIncorrect}`}
                    >
                      -{day.totalIncorrect}
                    </text>
                  )}

                  <text
                    x={x + barWidth / 2}
                    y={svgHeight - marginBottom + 16}
                    className={styles.xAxisText}
                  >
                    {formatDateLabel(day.date)}
                  </text>

                  <rect
                    x={x - 2}
                    y={marginTop}
                    width={barWidth + 4}
                    height={svgHeight - marginTop - marginBottom}
                    className={styles.dayColumnHit}
                    onMouseEnter={(e) => handleBarMouseEnter(day, e)}
                    onMouseMove={handleBarMouseMove}
                    onMouseLeave={handleBarMouseLeave}
                  />
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredDay && tooltipPos && (
            <div
              className={styles.tooltip}
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            >
              <div className={styles.tooltipDate}>{formatFullDate(hoveredDay.date)}</div>

              {mode === "accuracy" ? (
                <>
                  <div className={styles.tooltipSummary}>
                    <span className={styles.statCorrect}>
                      +{hoveredDay.totalCorrect} Correct
                    </span>
                    <span className={styles.statIncorrect}>
                      -{hoveredDay.totalIncorrect} Incorrect
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
                /* Default "Usage" mode tooltip: NO % CORRECT ANYWHERE! */
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
