import { useCallback, useRef, useState } from "react";
import { searchQuestions } from "./question_search_api";
import type { SearchFilters, SearchResultItem } from "./question_search_types";

export function useQuestionSearch(searchUrl: string) {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const lastFilters = useRef<SearchFilters | null>(null);
  const requestId = useRef(0);

  const runSearch = useCallback(
    async (filters: SearchFilters) => {
      lastFilters.current = filters;
      const currentRequest = ++requestId.current;

      setLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const rows = await searchQuestions(searchUrl, filters);
        if (currentRequest !== requestId.current) return;
        setResults(rows);
      } catch (err) {
        if (currentRequest !== requestId.current) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [searchUrl]
  );

  const rerun = useCallback(() => {
    if (lastFilters.current) void runSearch(lastFilters.current);
  }, [runSearch]);

  const removeResult = useCallback((questionId: number) => {
    setResults((prev) => prev.filter((item) => item.question_id !== questionId));
  }, []);

  return { results, loading, error, hasSearched, runSearch, rerun, removeResult };
}