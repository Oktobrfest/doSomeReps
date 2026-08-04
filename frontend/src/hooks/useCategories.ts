// CHANGED THIS - new shared hook so CatPicker and the new filter panel share one category fetch (Fork H2, DRY).
import { useEffect, useState } from "react";

let cachedCategories: string[] | null = null;

export function useCategories(): string[] {
  const [categories, setCategories] = useState<string[]>(cachedCategories ?? []);

  useEffect(() => {
    if (cachedCategories) return;
    let cancelled = false;

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

    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}