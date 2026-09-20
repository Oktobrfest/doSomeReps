import { useMemo } from "react";
import { byName } from "../lib/categories";
import styles from "./CategoryChoices.module.css";

interface CategoryChoicesProps {
  categories: string[];
  selected: string[];
  onToggle: (category: string) => void;
  emptyMessage?: string;
  /** Input name. Set it where the selection posts with a server-rendered form. */
  checkboxName?: string;
  /** Maps a category name onto the value the server expects. */
  checkboxValueFn?: (category: string) => string;
}

/**
 * A grid of categories to tick.
 *
 * Both pickers show the same chips, so whichever one a page happens to use, a
 * category looks and behaves the same way.
 */
export function CategoryChoices({
  categories,
  selected,
  onToggle,
  emptyMessage = "No categories yet.",
  checkboxName,
  checkboxValueFn,
}: CategoryChoicesProps) {
  const sorted = useMemo(() => [...categories].sort(byName), [categories]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  if (sorted.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <ul className={styles.grid}>
      {sorted.map((category) => {
        const checked = selectedSet.has(category);
        return (
          <li
            key={category}
            className={`${styles.item} ${checked ? styles.itemChecked : ""}`}
            onClick={() => onToggle(category)}
          >
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={checked}
              onChange={() => onToggle(category)}
              onClick={(event) => event.stopPropagation()}
              aria-label={category}
              name={checkboxName}
              value={checkboxValueFn ? checkboxValueFn(category) : category}
            />
            <span
              className={`${styles.itemLabel} ${checked ? styles.itemLabelChecked : ""}`}
              title={category}
            >
              {category}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
