import { useEffect, useState } from "react";

let cachedCategories: string[] | null = null;

/** Dispatched on document when a category is created outside React. */
export const CATEGORIES_CHANGED_EVENT = "repz:categories-changed";

export function useCategories(): string[] {
  const [categories, setCategories] = useState<string[]>(cachedCategories ?? []);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/categories")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch categories");
          return res.json();
        })
        .then((data) => {
          if (!Array.isArray(data) || cancelled) return;
          cachedCategories = data;
          setCategories(data);
        })
        .catch((err) => console.error("Error fetching categories:", err));
    };

    if (!cachedCategories) load();

    const refresh = () => {
      cachedCategories = null;
      load();
    };

    document.addEventListener(CATEGORIES_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      document.removeEventListener(CATEGORIES_CHANGED_EVENT, refresh);
    };
  }, []);

  return categories;
}
