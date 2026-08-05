import { useState } from "react";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";
import { CategoryPicker } from "../components/CategoryPicker";
import { useCategories } from "../hooks/useCategories";
import { FlagFilterChips } from "./FlagFilterChips";
import { EMPTY_FILTERS, type SearchFilters } from "./question_search_types";
import styles from "./QuestionSearch.module.css";

interface QuestionSearchPanelProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onSearch: () => void;
  loading: boolean;
}

const WITHIN_FIELDS = [
  { value: "question_text", label: "Question" },
  { value: "hint", label: "Hint" },
  { value: "answer", label: "Answer" },
];

export function QuestionSearchPanel({
  filters,
  onChange,
  onSearch,
  loading,
}: QuestionSearchPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const allCategories = useCategories();

  const patch = (partial: Partial<SearchFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleWithin = (value: string) =>
    patch({
      within: filters.within.includes(value)
        ? filters.within.filter((item) => item !== value)
        : [...filters.within, value],
    });

  const allCategoriesSelected =
    allCategories.length > 0 && filters.categories.length === allCategories.length;

  const toggleAllCategories = () =>
    patch({ categories: allCategoriesSelected ? [] : [...allCategories] });

  const activeCount =
    filters.within.length +
    filters.categories.length +
    filters.flags.length +
    (filters.excluded ? 1 : 0);

  return (
    <section className={styles.filterPanel}>
      <div className={styles.searchRow}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search questions..."
          value={filters.terms}
          onChange={(event) => patch({ terms: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <SlidersHorizontal size={15} />
          <span>Filters</span>
          {activeCount > 0 && <span className={styles.filterCount}>{activeCount}</span>}
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {expanded && (
        <div className={styles.filterBody}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Flags</span>
              <FlagFilterChips
                selected={filters.flags}
                onChange={(flags) => patch({ flags })}
              />
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Search within</span>
              <div className={styles.chipRow}>
                {WITHIN_FIELDS.map((field) => (
                  <button
                    key={field.value}
                    type="button"
                    aria-pressed={filters.within.includes(field.value)}
                    className={`${styles.chip} ${
                      filters.within.includes(field.value) ? styles.chipActive : ""
                    }`}
                    onClick={() => toggleWithin(field.value)}
                  >
                    {field.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={filters.excluded}
                  className={`${styles.chip} ${
                    filters.excluded ? styles.chipActive : ""
                  }`}
                  onClick={() => patch({ excluded: !filters.excluded })}
                >
                  Excluded questions
                </button>
              </div>
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Categories</span>
            <CategoryPicker
              selectedCategories={filters.categories}
              onChange={(categories) => patch({ categories })}
              showSelectAll={false}
            />
          </div>

          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={toggleAllCategories}
            >
              {allCategoriesSelected ? "Deselect all" : "Select all"}
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => onChange({ ...EMPTY_FILTERS })}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </section>
  );
}