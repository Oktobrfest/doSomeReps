import styles from "./CategoryChip.module.css";

export interface CategoryChipProps {
  name: string;
  /** Omit for a chip that only names a category; give it to make one pickable. */
  checked?: boolean;
  onToggle?: (name: string) => void;
  /** True while the chip is on its way to the other section of the picker. */
  moving?: boolean;
}

/**
 * The one way a category is drawn.
 *
 * Picking one and being shown one are the same chip, so a category a reader
 * ticked in the picker is the same thing they later read on the question.
 */
export function CategoryChip({ name, checked, onToggle, moving = false }: CategoryChipProps) {
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
      <span className={styles.name}>{name}</span>
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
