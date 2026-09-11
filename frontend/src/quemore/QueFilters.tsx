import sharedStyles from "../styles/shared.module.css";
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

/**
 * The five sources a search can draw from, as toggles rather than checkboxes:
 * the same on/off control the cards below are queued with, and a target a thumb
 * can hit.
 */
export function QueFilters({ filters, onChange }: QueFiltersProps) {
  return (
    <fieldset className={styles.filters}>
      <legend className={styles.filtersLegend}>Include</legend>
      <div className={sharedStyles.actionCluster}>
        {OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filters[key]}
            className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
              filters[key] ? sharedStyles.btnBlue : sharedStyles.btnQuiet
            }`}
            onClick={() => onChange({ ...filters, [key]: !filters[key] })}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
