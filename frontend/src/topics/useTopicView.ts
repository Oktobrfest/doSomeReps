import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SortDirection,
  TopicSort,
  TopicSortColumn,
  TopicSummary,
} from "./topics_types";

const SORT_PARAM = "sort";
const DIRECTION_PARAM = "direction";
const QUERY_PARAM = "q";

const SORT_COLUMNS: TopicSortColumn[] = ["name", "count"];

const isSortColumn = (value: string | null): value is TopicSortColumn =>
  value !== null && SORT_COLUMNS.includes(value as TopicSortColumn);

function readSortFromUrl(): TopicSort {
  const params = new URLSearchParams(window.location.search);
  const column = params.get(SORT_PARAM);

  return {
    column: isSortColumn(column) ? column : "name",
    direction: params.get(DIRECTION_PARAM) === "desc" ? "desc" : "asc",
  };
}

function readQueryFromUrl(): string {
  return new URLSearchParams(window.location.search).get(QUERY_PARAM) ?? "";
}

function compare(a: TopicSummary, b: TopicSummary, column: TopicSortColumn): number {
  return column === "name"
    ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    : a.questionCount - b.questionCount;
}

const flip = (direction: SortDirection): SortDirection =>
  direction === "asc" ? "desc" : "asc";

/**
 * What the topic list is currently showing: which topics survive the filter,
 * and in what order. Both live in the query string so a narrowed view stays
 * linkable, which is what the server-rendered sort links used to give us.
 */
export function useTopicView(topics: TopicSummary[]) {
  const [sort, setSort] = useState<TopicSort>(readSortFromUrl);
  const [query, setQuery] = useState<string>(readQueryFromUrl);

  const toggleSort = useCallback((column: TopicSortColumn) => {
    setSort((current) => ({
      column,
      direction: current.column === column ? flip(current.direction) : "asc",
    }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set(SORT_PARAM, sort.column);
    params.set(DIRECTION_PARAM, sort.direction);

    if (query) params.set(QUERY_PARAM, query);
    else params.delete(QUERY_PARAM);

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`
    );
  }, [sort, query]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const factor = sort.direction === "asc" ? 1 : -1;

    return topics
      .filter((topic) => topic.name.toLowerCase().includes(needle))
      .sort((a, b) => compare(a, b, sort.column) * factor);
  }, [topics, sort, query]);

  return { visible, sort, toggleSort, query, setQuery };
}
