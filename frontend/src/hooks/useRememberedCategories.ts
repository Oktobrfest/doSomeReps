import { useEffect, useRef } from "react";
import { saveSelectedCategories, type SelectionPage } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { notify } from "../toast/notify";

/**
 * Keep `page`'s selection for the reader's next visit. Only changes are saved,
 * not what the page opened with, and one at a time, so the last pick is kept.
 */
export function useRememberedCategories(page: SelectionPage, categories: string[]) {
  const saved = useRef(categories);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    if (categories === saved.current) return;
    saved.current = categories;
    writes.current = writes.current
      .then(() => saveSelectedCategories(page, categories))
      .catch((error: unknown) => {
        notify.error(errorMessage(error, "Could not save your categories."));
      });
  }, [page, categories]);
}
