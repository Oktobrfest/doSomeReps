import styles from "./Topics.module.css";
import type { TopicSort, TopicSortColumn, TopicSummary } from "./topics_types";

interface SortHeaderProps {
  label: string;
  column: TopicSortColumn;
  sort: TopicSort;
  onSort: (column: TopicSortColumn) => void;
}

function SortHeader({ label, column, sort, onSort }: SortHeaderProps) {
  const active = sort.column === column;
  const indicatorClass = active
    ? `${styles.sortIndicator} ${styles[sort.direction]}`
    : styles.sortIndicator;

  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => onSort(column)}
      >
        {label}
        {active && <span className={indicatorClass} aria-hidden="true" />}
      </button>
    </th>
  );
}

interface TopicTableProps {
  topics: TopicSummary[];
  sort: TopicSort;
  onSort: (column: TopicSortColumn) => void;
}

export function TopicTable({ topics, sort, onSort }: TopicTableProps) {
  return (
    <table className={styles.topicTable}>
      <thead>
        <tr>
          <SortHeader label="Topics" column="name" sort={sort} onSort={onSort} />
          <SortHeader
            label="Questions"
            column="count"
            sort={sort}
            onSort={onSort}
          />
        </tr>
      </thead>
      <tbody>
        {topics.map((topic) => (
          <tr key={topic.name}>
            <td>
              <a className={styles.topicLink} href={topic.url}>
                {topic.name}
              </a>
            </td>
            <td className={styles.countCell}>{topic.questionCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
