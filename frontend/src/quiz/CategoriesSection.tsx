import { useState } from 'react';
import { CategoryPicker } from '../components/CategoryPicker';
import { resolveCategoryNames } from '../lib/categories';
import sharedStyles from '../styles/shared.module.css';
import styles from './CategoriesSection.module.css';

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
  categoryList = [],
  initialSelectedCategories = [],
  onApply,
  disabled = false,
}: CategoriesSectionProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    resolveCategoryNames(initialSelectedCategories, categoryList),
  );

  return (
    <div className={styles.categoriesSection}>
      <CategoryPicker
        selectedCategories={selected}
        onChange={setSelected}
        savedLists
        selectAll
      />

      <div className={`${sharedStyles.actionCluster} ${styles.applyRow}`}>
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonTouchSm} ${sharedStyles.buttonWrap} ${styles.applyButton}`}
          disabled={disabled}
          onClick={() => onApply?.(selected)}
        >
          Apply Categories
        </button>
      </div>
    </div>
  );
}
