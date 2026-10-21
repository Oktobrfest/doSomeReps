import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import type { CategoryToDoItem, DailyQuizStat } from "./home_types";
import { createCategoryColorScale, extractSortedCategories } from "./categoryColors";
import styles from "./CategoriesToDoChart.module.css";

interface CategoriesToDoChartProps {
  categories: CategoryToDoItem[];
  fallbackImage?: string;
  dailyHistory?: DailyQuizStat[];
}

export function CategoriesToDoChart({
  categories,
  fallbackImage,
  dailyHistory = [],
}: CategoriesToDoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryToDoItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Measure container width to ensure the chart is as wide as the activity chart
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute category color mapping matching the activity chart legend
  const historySortedCategories = useMemo(
    () => extractSortedCategories(dailyHistory),
    [dailyHistory]
  );

  const colorScale = useMemo(() => {
    const extra = categories.map((c) => c.category);
    return createCategoryColorScale(historySortedCategories, extra);
  }, [historySortedCategories, categories]);

  // Layout dimensions
  const svgHeight = 270;
  const marginTop = 24;
  const marginBottom = 64;
  const marginLeft = 48;
  const marginRight = 24;

  const availableWidth = Math.max(160, containerWidth - marginLeft - marginRight);

  // Allow as many categories as fit across the wide chart area without overcrowding
  const MIN_CATEGORY_SLOT = 52;
  const maxCategoriesFit = Math.max(1, Math.floor(availableWidth / MIN_CATEGORY_SLOT));

  const displayedCategories = useMemo(() => {
    return categories.slice(0, Math.min(categories.length, maxCategoriesFit));
  }, [categories, maxCategoriesFit]);

  // Total due count
  const totalDue = useMemo(
    () => categories.reduce((sum, item) => sum + item.count, 0),
    [categories]
  );

  // If no structured categories data is available but a fallback image is, render fallback
  if (categories.length === 0 && fallbackImage) {
    return (
      <section className={styles.container} ref={containerRef}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h3 className={styles.title}>Categories to Do</h3>
            <p className={styles.subtitle}>Questions due grouped by category</p>
          </div>
        </div>
        <img
          className={styles.fallbackImage}
          src={`data:image/png;base64,${fallbackImage}`}
          alt="Bar chart of your due questions grouped by category"
        />
      </section>
    );
  }

  if (displayedCategories.length === 0) {
    return null;
  }

  // Scales
  const xScale = d3
    .scaleBand()
    .domain(displayedCategories.map((d) => d.category))
    .range([0, availableWidth])
    .padding(0.28);

  const slotBandwidth = xScale.bandwidth();

  // Make bars wider to fill the wide chart, up to a limit of ridiculousness (max 96px)
  const MAX_BAR_WIDTH = 96;
  const MIN_BAR_WIDTH = 14;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slotBandwidth));
  const barOffset = (slotBandwidth - barWidth) / 2;

  const maxCount = Math.max(...displayedCategories.map((d) => d.count), 1);
  const yScale = d3
    .scaleLinear()
    .domain([0, maxCount])
    .nice()
    .range([svgHeight - marginBottom, marginTop]);

  const rawTicks = yScale.ticks(Math.min(maxCount, 5));
  const yTicks = Array.from(new Set(rawTicks.map((t) => Math.round(t)))).sort((a, b) => b - a);
  const yZero = yScale(0);

  const handleMouseEnter = (item: CategoryToDoItem, e: React.MouseEvent) => {
    setHoveredCategory(item);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredCategory(null);
    setTooltipPos(null);
  };

  return (
    <section className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h3 className={styles.title}>Categories to Do</h3>
          <p className={styles.subtitle}>
            {categories.length > displayedCategories.length
              ? `Showing top ${displayedCategories.length} of ${categories.length} due categories`
              : "Due questions grouped by category"}
          </p>
        </div>
        <div className={styles.badge}>
          <span>{totalDue} due question{totalDue === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <svg
          className={styles.chartSvg}
          width={containerWidth}
          height={svgHeight}
          role="img"
          aria-label="Categories to do bar chart"
        >
          <g transform={`translate(${marginLeft}, 0)`}>
            {/* Grid lines */}
            {yTicks.map((tick) => (
              <line
                key={tick}
                x1={0}
                y1={yScale(tick)}
                x2={availableWidth}
                y2={yScale(tick)}
                className={styles.gridLine}
              />
            ))}

            {/* Zero line */}
            <line
              x1={0}
              y1={yZero}
              x2={availableWidth}
              y2={yZero}
              className={styles.axisBaseline}
            />

            {/* Y-Axis tick labels */}
            {yTicks.map((tick) => (
              <text
                key={tick}
                x={-8}
                y={yScale(tick) + 4}
                className={styles.yTickText}
              >
                {tick}
              </text>
            ))}

            {/* Bars and labels */}
            {displayedCategories.map((item) => {
              const bandX = xScale(item.category) ?? 0;
              const barX = bandX + barOffset;
              const barY = yScale(item.count);
              const barHeight = Math.max(0, yZero - barY);
              const color = colorScale(item.category);
              const isDimmed = hoveredCategory !== null && hoveredCategory.category !== item.category;

              return (
                <g
                  key={item.category}
                  className={styles.barGroup}
                  onMouseEnter={(e) => handleMouseEnter(item, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* The colored bar */}
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={0.75}
                    rx={3}
                    className={`${styles.bar} ${isDimmed ? styles.barDimmed : ""}`}
                  />

                  {/* Value label on top of bar */}
                  {item.count > 0 && barWidth >= 16 && (
                    <text
                      x={barX + barWidth / 2}
                      y={barY - 5}
                      className={styles.barValueLabel}
                    >
                      {item.count}
                    </text>
                  )}

                  {/* Rotated category label below baseline */}
                  <text
                    x={bandX + slotBandwidth / 2}
                    y={yZero + 12}
                    transform={`rotate(-35, ${bandX + slotBandwidth / 2}, ${yZero + 12})`}
                    className={styles.xTickText}
                  >
                    {item.category}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover Tooltip */}
        {hoveredCategory &&
          tooltipPos &&
          createPortal(
            <div
              className={styles.tooltip}
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            >
              <span
                className={styles.tooltipSwatch}
                style={{ backgroundColor: colorScale(hoveredCategory.category) }}
              />
              <span className={styles.tooltipCategory}>
                {hoveredCategory.category}:
              </span>
              <span className={styles.tooltipCount}>
                {hoveredCategory.count} due question
                {hoveredCategory.count === 1 ? "" : "s"}
              </span>
            </div>,
            document.body
          )}
      </div>
    </section>
  );
}
