import React from "react";
import { FLAG_METADATA } from "../components/FlagConstants";
import type { SearchResultItem } from "./question_search_types";
import styles from "./QuestionSearch.module.css";

interface QuestionResultRowProps {
  item: SearchResultItem;
  selected: boolean;
  showUnexclude: boolean;
  onSelect: (questionId: number) => void;
  onUnexclude: (questionId: number) => void;
}

export function QuestionResultRow({
  item,
  selected,
  showUnexclude,
  onSelect,
  onUnexclude,
}: QuestionResultRowProps) {
  const flagMeta = item.flag ? FLAG_METADATA[item.flag.category] : null;

  return (
    <li
      className={`${styles.resultRow} ${selected ? styles.resultRowSelected : ""}`}
    >
      <button
        type="button"
        className={styles.resultButton}
        onClick={() => onSelect(item.question_id)}
        aria-current={selected}
      >
        {flagMeta && (
          <span
            className={`${styles.flagChip} ${flagMeta.colorClass}`}
            title={item.flag?.note || flagMeta.label}
          >
            {React.cloneElement(flagMeta.icon as React.ReactElement, {
              className: styles.flagChipIcon,
            })}
            <span>{flagMeta.label}</span>
          </span>
        )}

        <span
          className={selected ? styles.resultTextFull : styles.resultText}
          title={item.question_text}
        >
          {item.question_text}
        </span>

        {item.categories.length > 0 && (
          <span className={styles.catChipRow}>
            {item.categories.map((cat) => (
              <span key={cat} className={styles.catChip}>
                {cat}
              </span>
            ))}
          </span>
        )}
      </button>

      {showUnexclude && (
        <button
          type="button"
          className={styles.unexcludeBtn}
          onClick={() => onUnexclude(item.question_id)}
        >
          Unexclude
        </button>
      )}
    </li>
  );
}