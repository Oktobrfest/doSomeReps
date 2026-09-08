import { readBootstrap as readShared } from "../lib/bootstrap";
import type {
  EditQuestionsBootstrap,
  SearchFilters,
  SearchResultItem,
} from "./question_search_types";

export function readBootstrap(): EditQuestionsBootstrap {
  return readShared<EditQuestionsBootstrap>("edit-questions-bootstrap", "edit-questions");
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.msg === "string") return data.msg;
    if (typeof data?.error === "string") return data.error;
  } catch {
    // fall through
  }
  return fallback;
}

export async function searchQuestions(
  url: string,
  filters: SearchFilters
): Promise<SearchResultItem[]> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "search-terms": filters.terms,
      "search-categories": filters.categories,
      "search-within": filters.within,
      "excluded-filter-checkbox": filters.excluded,
      "flag-categories": filters.flags,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Search failed."));
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as SearchResultItem[]) : [];
}

export async function unexcludeQuestion(
  url: string,
  questionId: number
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(questionId),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to unexclude the question."));
  }
}