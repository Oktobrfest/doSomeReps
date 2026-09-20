import { useEffect, useState } from "react";
import { CATEGORIES_CHANGED_EVENT } from "../lib/categories";

let cachedCategories: string[] | null = null;

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
