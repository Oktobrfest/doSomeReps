import { LoadingState } from "../components/LoadingState";
import { ChevronLeft } from "lucide-react";
import { QuestionResultRow } from "./QuestionResultRow";
import type { SearchResultItem } from "./question_search_types";
import styles from "./QuestionSearch.module.css";

interface QuestionResultsListProps {
  items: SearchResultItem[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  showUnexclude: boolean;
  onSelect: (questionId: number) => void;
  onUnexclude: (questionId: number) => void;
  onCollapse?: () => void;
}

export function QuestionResultsList({
  items,
  selectedId,
  loading,
  error,
  hasSearched,
  showUnexclude,
  onSelect,
  onUnexclude,
  onCollapse,
}: QuestionResultsListProps) {
  return (
    <div className={styles.resultsPane}>
      <div className={styles.resultsHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 className={styles.resultsTitle}>Results</h2>
          <span className={styles.resultsCount}>{items.length}</span>
        </div>
        {onCollapse && (
          <button
            type="button"
            className={styles.collapseResultsBtn}
            onClick={onCollapse}
            title="Collapse search results"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div className={styles.resultsScroll}>
        {loading && (
          <LoadingState />
        )}

        {!loading && error && <p className={styles.resultsEmpty}>{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className={styles.resultsEmpty}>
            {hasSearched
              ? "No questions matched these filters."
              : "Set your filters and hit Search to begin."}
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className={styles.resultsList}>
            {items.map((item) => (
              <QuestionResultRow
                key={item.question_id}
                item={item}
                selected={item.question_id === selectedId}
                showUnexclude={showUnexclude}
                onSelect={onSelect}
                onUnexclude={onUnexclude}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}