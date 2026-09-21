import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "../hooks/useCategories";
import { byName, createCategory } from "../lib/categories";
import { CategoryChoices } from "./CategoryChoices";
import { QuizModal } from "./QuizModal";
import { SavedCategoryLists } from "./SavedCategoryLists";
import styles from "./CategoryPicker.module.css";

// # CHANGED THIS - one picker owns the two real presentation modes instead of duplicating category behavior across CatPicker and CategoryPicker.
export interface CategoryPickerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  mode?: "search" | "grid";
  savedLists?: boolean;
  selectAll?: boolean;
  collapsed?: boolean;
  form?: { name: string; value?: (category: string) => string; apply?: boolean };
}

export function CategoryPicker({
  selectedCategories,
  onChange,
  mode = "search",
  savedLists = false,
  selectAll = false,
  collapsed = false,
  form,
}: CategoryPickerProps) {
  const allCategories = useCategories();
  const categories = useMemo(() => [...allCategories].sort(byName), [allCategories]);
  const [query, setQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  // # CHANGED THIS - search behavior stays local because no other component needs a second search state/controller abstraction.
  useEffect(() => {
    if (mode !== "search") return;
    const closeSuggestions = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSuggesting(false);
    };
    document.addEventListener("mousedown", closeSuggestions);
    return () => document.removeEventListener("mousedown", closeSuggestions);
  }, [mode]);

  const toggle = (category: string) =>
    onChange(selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category]);

  const allSelected = categories.length > 0 && categories.every((category) => selectedCategories.includes(category));
  const toggleAll = () => onChange(allSelected ? [] : [...categories]);
  const trimmed = query.trim();
  const suggestions = useMemo(
    () => categories.filter((category) =>
      !selectedCategories.includes(category) && category.toLowerCase().includes(trimmed.toLowerCase())),
    [categories, selectedCategories, trimmed]
  );
  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? categories.filter((category) => category.toLowerCase().includes(needle)) : categories;
  }, [categories, filter]);
  const creatable = trimmed.length > 0 && !categories.some((category) => category.toLowerCase() === trimmed.toLowerCase());

  const select = (category: string) => {
    if (!selectedCategories.includes(category)) onChange([...selectedCategories, category]);
    setQuery("");
    setSuggesting(false);
  };

  const create = async () => {
    if (!creatable || creating) return;
    setCreating(true);
    try {
      const category = await createCategory(trimmed);
      select(category);
      toast.success(`Category "${category}" created.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create that category.");
    } finally {
      setCreating(false);
    }
  };

  // # CHANGED THIS - collapsed server forms stay mounted so checked category inputs continue to submit.
  if (collapsed) {
    return (
      <div hidden>
        <CategoryChoices
          categories={categories}
          selected={selectedCategories}
          onToggle={toggle}
          checkboxName={form?.name}
          checkboxValueFn={form?.value}
        />
      </div>
    );
  }

  const listControls = savedLists ? (
    <SavedCategoryLists categories={categories} selected={selectedCategories} onChange={onChange} />
  ) : null;

  // # CHANGED THIS - grid consumers get only the controls they actually need; search/create/modal code is not duplicated here.
  if (mode === "grid") {
    return (
      <div className={styles.gridPicker}>
        {listControls}
        <CategoryChoices
          categories={categories}
          selected={selectedCategories}
          onToggle={toggle}
          checkboxName={form?.name}
          checkboxValueFn={form?.value}
        />
        {(selectAll || form?.apply) && (
          <div className={styles.footer}>
            {/* # CHANGED THIS - use a local action row instead of the site-wide footer element styling. */}
            <div className={styles.footerActions}>
              {selectAll && <button type="button" className={styles.btnSecondary} onClick={toggleAll}>{allSelected ? "Deselect all" : "Select all"}</button>}
              {form?.apply && <button type="submit" name="apply-categories" value="Apply" className={styles.btnPrimary}>Apply</button>}
            </div>
            <span className={styles.count}>{selectedCategories.length} of {categories.length} selected</span>
          </div>
        )}
      </div>
    );
  }

  // # CHANGED THIS - search mode uses one calm surface; Browse all lives beside the search label instead of in a redundant title bar.
  return (
    <div className={styles.picker} ref={searchRef}>
      <div className={styles.body}>
        {listControls}
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={searchId}>Search categories</label>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setShowAll(true)}
          >
            Browse all
          </button>
        </div>
        <div className={styles.search}>
          <input
            id={searchId}
            type="text"
            className={styles.input}
            placeholder="Type a category name to search or add..."
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSuggesting(true); }}
            onFocus={() => setSuggesting(true)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (suggestions.length > 0) select(suggestions[0]);
              else void create();
            }}
          />
          {suggesting && (suggestions.length > 0 || creatable) && (
            <ul className={styles.suggestions}>
              {suggestions.map((category) => (
                <li key={category}>
                  <button type="button" className={styles.suggestion} onClick={() => select(category)}>{category}</button>
                </li>
              ))}
              {creatable && (
                <li>
                  <button type="button" className={`${styles.suggestion} ${styles.create}`} onClick={() => void create()} disabled={creating}>
                    <Plus size={16} />
                    <span>{creating ? "Adding..." : `Create "${trimmed}"`}</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
        {/* # CHANGED THIS - show selection count beside the section label instead of hiding it in a heavy footer. */}
        <div className={styles.selectedRow}>
          <span className={styles.label}>Selected</span>
          <span className={styles.selectedCount}>{selectedCategories.length} selected</span>
        </div>
        <CategoryChoices
          categories={selectedCategories}
          selected={selectedCategories}
          onToggle={toggle}
          emptyMessage="Nothing selected yet. Search above to add a category."
        />
      </div>

      {showAll && (
        <QuizModal title="All Categories" onClose={() => setShowAll(false)}>
          <div className={styles.modalBody}>
            <input type="text" className={styles.input} placeholder="Filter categories..." value={filter} onChange={(event) => setFilter(event.target.value)} />
            <CategoryChoices categories={filtered} selected={selectedCategories} onToggle={toggle} emptyMessage="No matching categories found." />
            {/* # CHANGED THIS - keep modal actions on the modal surface; no global footer chrome or unrelated blue action. */}
            <div className={styles.modalFooter}>
              {selectAll && <button type="button" className={styles.btnSecondary} onClick={toggleAll}>{allSelected ? "Deselect all" : "Select all"}</button>}
              <span className={styles.count}>{selectedCategories.length} of {categories.length} selected</span>
            </div>
          </div>
        </QuizModal>
      )}
    </div>
  );
}
