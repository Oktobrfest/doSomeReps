import styles from "./QueMore.module.css";
import type { QueFilterState } from "./quemore_types";

interface QueFiltersProps {
  filters: QueFilterState;
  onChange: (filters: QueFilterState) => void;
}

const OPTIONS: Array<{ key: keyof QueFilterState; label: string }> = [
  { key: "personal", label: "Personal" },
  { key: "favorate", label: "Favorite Users" },
  { key: "public", label: "Public" },
  { key: "blocked", label: "Blocked Users" },
  { key: "excluded", label: "Excluded Questions" },
];

export function QueFilters({ filters, onChange }: QueFiltersProps) {
  return (
    <fieldset className={styles.filters}>
      <legend className={styles.filtersLegend}>Include</legend>
      <div className={styles.filterRow}>
        {OPTIONS.map(({ key, label }) => (
          <label key={key} className={styles.filterOption} htmlFor={`filter-${key}`}>
            <input
              type="checkbox"
              id={`filter-${key}`}
              checked={filters[key]}
              onChange={(event) =>
                onChange({ ...filters, [key]: event.target.checked })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
