import { useState } from 'react';
import { CatPicker } from '../components/CatPicker';
import sharedStyles from '../styles/shared.module.css';
import styles from './CategoriesSection.module.css';

/** Categories arrive from the server as slugs or as display names. */
function normaliseCategories(initial?: string[], all?: string[]) {
  if (!initial) return [];

  const known = new Set(all ?? []);

  return initial.map((raw) => {
    if (known.has(raw)) return raw;

    const decoded = raw.replace(/_/g, ' ');
    if (known.has(decoded)) return decoded;

    return decoded;
  });
}

interface CategoriesSectionProps {
  categoryList?: string[];
  initialSelectedCategories?: string[];
  onApply?: (categories: string[]) => void;
  disabled?: boolean;
}

/**
 * Which categories the queue is drawn from.
 *
 * A phone keeps this in the slide-out panel and a full-sized page keeps it in a
 * disclosure under the navbar, so it owns its own draft selection wherever it
 * is mounted and hands it over only when the reader applies it.
 */
export function CategoriesSection({
  categoryList,
  initialSelectedCategories,
  onApply,
  disabled = false,
}: CategoriesSectionProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    normaliseCategories(initialSelectedCategories, categoryList),
  );

  return (
    <div className={styles.categoriesSection}>
      <CatPicker selectedCategories={selected} onChange={setSelected} />

      <div className={`${sharedStyles.actionCluster} ${styles.applyRow}`}>
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonTouchSm} ${sharedStyles.buttonWrap} ${sharedStyles.btnBlue}`}
          disabled={disabled}
          onClick={() => onApply?.(selected)}
        >
          Apply Categories
        </button>
      </div>
    </div>
  );
}
