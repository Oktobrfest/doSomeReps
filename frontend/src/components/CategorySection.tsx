import type { ReactNode } from "react";
import { CategoryChip } from "./CategoryChip";
import styles from "./CategorySection.module.css";

export interface CategoryItem {
  name: string;
  checked: boolean;
  /** True while the chip is leaving on its way to the other section. */
  moving?: boolean;
}

interface CategorySectionProps {
  title: string;
  /** In display order: the section lays them out and never re-sorts them. */
  items: CategoryItem[];
  onToggle: (name: string) => void;
  /** The section's one bulk action. Omit where acting on every category is meaningless. */
  bulk?: { label: string; onClick: () => void };
  /** What stands in for the chips when there are none. */
  empty: ReactNode;
}

/**
 * One titled list of categories.
 *
 * Selected and unselected are the same section with different ticks and a
 * different bulk action, so the two halves of the picker cannot drift apart.
 */
export function CategorySection({ title, items, onToggle, bulk, empty }: CategorySectionProps) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{items.length}</span>
        {bulk && items.length > 0 && (
          <button type="button" className={styles.bulk} onClick={bulk.onClick}>
            {bulk.label}
          </button>
        )}
      </header>

      {items.length > 0 ? (
        <ul className={styles.chips}>
          {items.map((item) => (
            <li key={item.name}>
              <CategoryChip {...item} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      ) : (
        empty
      )}
    </section>
  );
}
