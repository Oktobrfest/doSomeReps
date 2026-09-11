import { ArrowDown, ArrowUp, Search } from "lucide-react";
import sharedStyles from "../styles/shared.module.css";
import styles from "./Topics.module.css";
import type { TopicSort, TopicSortColumn } from "./topics_types";

const SORT_OPTIONS: Array<{ column: TopicSortColumn; label: string }> = [
  { column: "name", label: "Name" },
  { column: "count", label: "Questions" },
];

interface TopicToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  sort: TopicSort;
  onSort: (column: TopicSortColumn) => void;
}

/**
 * The two things a reader does to a hundred topics: narrow them to the one they
 * are after, and decide whether the biggest or the alphabetical first leads.
 * Picking the column already in use flips its direction.
 */
export function TopicToolbar({
  query,
  onQueryChange,
  sort,
  onSort,
}: TopicToolbarProps) {
  const Direction = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchField}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter topics"
          aria-label="Filter topics"
        />
      </div>

      <div className={styles.sortGroup} role="group" aria-label="Sort topics">
        {SORT_OPTIONS.map(({ column, label }) => {
          const active = sort.column === column;

          return (
            <button
              key={column}
              type="button"
              aria-pressed={active}
              className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                active ? sharedStyles.btnBlue : sharedStyles.btnQuiet
              }`}
              onClick={() => onSort(column)}
            >
              <span>{label}</span>
              {active && (
                <Direction className={sharedStyles.buttonIcon} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
