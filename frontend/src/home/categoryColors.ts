import * as d3 from "d3";
import type { DailyQuizStat } from "./home_types";

export const CATEGORY_COLOR_PALETTE: readonly string[] = [
  ...d3.schemeTableau10,
  ...d3.schemePaired,
  ...d3.schemeSet3,
];

export function extractSortedCategories(data: DailyQuizStat[]): string[] {
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
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .map(([cat]) => cat);
}

export function createCategoryColorScale(
  sortedCategories: string[],
  extraCategories?: string[]
): (category: string) => string {
  const domain = [...sortedCategories];
  if (extraCategories) {
    for (const cat of extraCategories) {
      if (!domain.includes(cat)) {
        domain.push(cat);
      }
    }
  }
  const scale = d3
    .scaleOrdinal<string, string>()
    .domain(domain)
    .range(CATEGORY_COLOR_PALETTE);
  return (category: string) => scale(category);
}
