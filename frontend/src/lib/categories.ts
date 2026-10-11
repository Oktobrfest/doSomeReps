/**
 * Categories travel as slugs in URLs, form values and session state, but are
 * stored and displayed as spaced names. These are the conversions between them,
 * and the one way to create one.
 */

import { csrfHeaders, jsonHeaders } from "./http";

export const toSlug = (value: string) => value.replace(/ /g, "_");

export const fromSlug = (slug: string) => slug.replace(/_/g, " ");

/** Dispatched on document whenever the category table changes. */
export const CATEGORIES_CHANGED_EVENT = "repz:categories-changed";

/** One ordering for every list of categories the app shows. */
export const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/**
 * Map slugs back onto the canonical names in the category table.
 *
 * A slug with no match falls back to its spaced form, so a category that has
 * been renamed or removed still shows the user something readable.
 */
export function resolveCategoryNames(
  values: string[],
  categoryList: string[]
): string[] {
  const namesBySlug = new Map(categoryList.map((category) => [toSlug(category), category]));
  return values.map((value) => namesBySlug.get(toSlug(value)) ?? fromSlug(value));
}

/** The pages that draw from many categories; each remembers its own selection. */
export type SelectionPage = "quiz" | "quemore" | "editquestions";

/** Keep `categories` as the selection `page` opens with on the reader's next visit. */
export async function saveSelectedCategories(page: SelectionPage, categories: string[]): Promise<void> {
  const response = await fetch(`/api/selected-categories/${page}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ categories: categories.map(toSlug) }),
  });
  if (!response.ok) throw new Error("Could not save your categories. Please try again.");
}

/** Create a category and tell every mounted picker to refetch. */
export async function createCategory(name: string): Promise<string> {
  const body = new FormData();
  body.append("add_category_field", name);

  const response = await fetch("/addcat", {
    method: "POST",
    headers: csrfHeaders(),
    body,
  });

  const data = (await response.json().catch(() => ({}))) as {
    name?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Could not create that category.");
  }

  document.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT));
  return data.name ?? name;
}
