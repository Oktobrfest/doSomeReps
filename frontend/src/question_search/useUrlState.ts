// CHANGED THIS - new hook keeping filters and the selected question in the URL so refresh, back
// and link-sharing all restore the same view (Fork I2).
import { useCallback } from "react";
import {
  EMPTY_FILTERS,
  type FlagFilterKey,
  type SearchFilters,
} from "./question_search_types";

const csv = (value: string | null): string[] =>
  value ? value.split(",").filter(Boolean) : [];

export function readUrlState(): {
  filters: SearchFilters;
  questionId: number | null;
} {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get("q_id");
  const parsedId = rawId ? parseInt(rawId, 10) : NaN;

  return {
    filters: {
      ...EMPTY_FILTERS,
      terms: params.get("q") ?? "",
      within: csv(params.get("within")),
      categories: csv(params.get("cats")),
      excluded: params.get("excluded") === "1",
      flags: csv(params.get("flags")) as FlagFilterKey[],
    },
    questionId: Number.isNaN(parsedId) ? null : parsedId,
  };
}

export function useWriteUrlState() {
  return useCallback((filters: SearchFilters, questionId: number | null) => {
    const params = new URLSearchParams();

    if (filters.terms) params.set("q", filters.terms);
    if (filters.within.length) params.set("within", filters.within.join(","));
    if (filters.categories.length) params.set("cats", filters.categories.join(","));
    if (filters.excluded) params.set("excluded", "1");
    if (filters.flags.length) params.set("flags", filters.flags.join(","));
    if (questionId !== null) params.set("q_id", String(questionId));

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, []);
}