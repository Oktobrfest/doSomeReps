import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "../hooks/useCategories";
import { byName, createCategory } from "../lib/categories";
import { CategoryChoices } from "./CategoryChoices";
import { QuizModal } from "./QuizModal";
import sharedStyles from "../styles/shared.module.css";
import styles from "./CatPicker.module.css";

interface CatPickerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

/**
 * The picker every page uses to tag or filter by category.
 *
 * Typing searches; a name that matches nothing offers to create itself, so the
 * one thing a writer wants mid-thought - a category that does not exist yet -
 * does not mean leaving the form. "See All" opens the full list.
 */
export function CatPicker({ selectedCategories, onChange }: CatPickerProps) {
  const allCategories = useCategories();
  const [query, setQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setSuggesting(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const trimmed = query.trim();

  const suggestions = useMemo(
    () =>
      allCategories
        .filter(
          (cat) =>
            !selectedCategories.includes(cat) &&
            cat.toLowerCase().includes(trimmed.toLowerCase())
        )
        .sort(byName),
    [allCategories, selectedCategories, trimmed]
  );

  const filtered = useMemo(
    () =>
      allCategories.filter((cat) =>
        cat.toLowerCase().includes(filter.toLowerCase())
      ),
    [allCategories, filter]
  );

  /** Only offer to create a name that is not already a category. */
  const creatable =
    trimmed.length > 0 &&
    !allCategories.some((cat) => cat.toLowerCase() === trimmed.toLowerCase());

  const toggle = (category: string) =>
    onChange(
      selectedCategories.includes(category)
        ? selectedCategories.filter((item) => item !== category)
        : [...selectedCategories, category]
    );

  const select = (category: string) => {
    if (!selectedCategories.includes(category)) {
      onChange([...selectedCategories, category]);
    }
    setQuery("");
    setSuggesting(false);
  };

  const create = async () => {
    if (!creatable || creating) return;

    setCreating(true);
    try {
      const created = await createCategory(trimmed);
      select(created);
      toast.success(`Category "${created}" created.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create that category."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.picker} ref={containerRef}>
      <header className={styles.header}>
        <span>Category Selection</span>
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
          onClick={() => setShowAll(true)}
        >
          See All
        </button>
      </header>

      <div className={styles.body}>
        <label className={styles.label} htmlFor={searchId}>
          Search Categories
        </label>

        <div className={styles.search}>
          <input
            id={searchId}
            type="text"
            className={styles.input}
            placeholder="Type a category name to search or add..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggesting(true);
            }}
            onFocus={() => setSuggesting(true)}
            onKeyDown={(event) => {
              // This input can sit inside a form; Enter must not submit it.
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (suggestions.length > 0) select(suggestions[0]);
              else void create();
            }}
          />

          {suggesting && (suggestions.length > 0 || creatable) && (
            <ul className={styles.suggestions}>
              {suggestions.map((cat) => (
                <li key={cat}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => select(cat)}
                  >
                    {cat}
                  </button>
                </li>
              ))}

              {creatable && (
                <li>
                  <button
                    type="button"
                    className={`${styles.suggestion} ${styles.create}`}
                    onClick={() => void create()}
                    disabled={creating}
                  >
                    <Plus size={16} />
                    <span>
                      {creating ? "Adding..." : `Create "${trimmed}"`}
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        <span className={styles.label}>Selected Categories</span>
        <CategoryChoices
          categories={selectedCategories}
          selected={selectedCategories}
          onToggle={toggle}
          emptyMessage="Nothing selected yet. Search above to add a category."
        />
      </div>

      {showAll && (
        <QuizModal title="All Categories" onClose={() => setShowAll(false)}>
          <div className={styles.body}>
            <input
              type="text"
              className={styles.input}
              placeholder="Filter categories..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />

            <CategoryChoices
              categories={filtered}
              selected={selectedCategories}
              onToggle={toggle}
              emptyMessage="No matching categories found."
            />

            <span className={styles.count}>
              {selectedCategories.length} of {allCategories.length} selected
            </span>
          </div>
        </QuizModal>
      )}
    </div>
  );
}
