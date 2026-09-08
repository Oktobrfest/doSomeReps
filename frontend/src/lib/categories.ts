/**
 * Categories travel as slugs in URLs, form values and session state, but are
 * stored and displayed as spaced names. These are the conversions between them.
 */

export const toSlug = (value: string) => value.replace(/ /g, "_");

export const fromSlug = (slug: string) => slug.replace(/_/g, " ");

/**
 * Map slugs back onto the canonical names in the category table.
 *
 * A slug with no match falls back to its spaced form, so a category that has
 * been renamed or removed still shows the user something readable.
 */
export function resolveCategoryNames(
  slugs: string[],
  categoryList: string[]
): string[] {
  return slugs.map(
    (slug) => categoryList.find((cat) => toSlug(cat) === slug) ?? fromSlug(slug)
  );
}
