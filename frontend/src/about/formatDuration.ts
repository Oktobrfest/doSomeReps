/** One decimal place, with a trailing ".0" dropped. */
function trim(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? Number(fixed).toFixed() : fixed;
}

/**
 * Renders a raw `days_hence` interval in its largest sensible unit. Ported from
 * the /about handler that used to live in `static/js/index.js`.
 */
export function formatDuration(days: number): string {
  if (days < 0.04) {
    return `${(days * 24 * 60).toFixed()} Mins`;
  }
  if (days < 2) {
    return `${(days * 24).toFixed()} Hours`;
  }
  if (days >= 365) {
    const years = trim(days / 365);
    return `${years} ${years === "1" ? "year" : "years"}`;
  }
  if (days >= 30) {
    return `${trim(days / 30.4)} months`;
  }
  if (days >= 7) {
    return `${trim(days / 7)} weeks`;
  }
  return `${days.toFixed()} days`;
}
