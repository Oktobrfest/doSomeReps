import type { ReactNode } from "react";
import styles from "./CategoryChip.module.css";

export interface CategoryChipProps {
  name: string;
  /** Omit for a chip that only names a category; give it to make one pickable. */
  checked?: boolean;
  onToggle?: (name: string) => void;
  /** True while the chip is on its way to the other section of the picker. */
  moving?: boolean;
  /** What the reader is filtering on, marked wherever it occurs in the name. */
  highlight?: string;
}

/**
 * A name with every occurrence of `query` marked.
 *
 * It walks the string with `indexOf` rather than building a pattern, so a
 * category or a filter containing `(`, `*` or `\` is matched literally and
 * there is nothing to escape.
 */
function markMatches(name: string, query: string): ReactNode {
  if (query === "") return name;

  const haystack = name.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;

  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push(name.slice(from, at));
    parts.push(
      <mark key={at} className={styles.match}>
        {name.slice(at, at + needle.length)}
      </mark>
    );
    from = at + needle.length;
  }

  if (parts.length === 0) return name;
  if (from < name.length) parts.push(name.slice(from));
  return parts;
}

/**
 * The one way a category is drawn.
 *
 * Picking one and being shown one are the same chip, so a category a reader
 * ticked in the picker is the same thing they later read on the question.
 */
export function CategoryChip({
  name,
  checked,
  onToggle,
  moving = false,
  highlight = "",
}: CategoryChipProps) {
  if (checked === undefined) {
    return <span className={styles.chip}>{name}</span>;
  }

  return (
    <label
      className={`${styles.chip} ${styles.pickable} ${checked ? styles.checked : ""} ${moving ? styles.moving : ""}`}
      title={name}
    >
      <input
        type="checkbox"
        className={styles.box}
        checked={checked}
        onChange={() => onToggle?.(name)}
      />
      <span className={styles.name}>{markMatches(name, highlight)}</span>
    </label>
  );
}

interface CategoryChipsProps {
  names: string[];
  /** Flow and scale only: the host decides where the row sits and how big it reads. */
  className?: string;
}

/** A wrapping row of the categories something carries. */
export function CategoryChips({ names, className }: CategoryChipsProps) {
  if (names.length === 0) return null;

  return (
    <span className={`${styles.row} ${className ?? ""}`}>
      {names.map((name) => (
        <CategoryChip key={name} name={name} />
      ))}
    </span>
  );
}
