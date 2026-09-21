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
  // # CHANGED THIS - use the shared normalizer instead of maintaining quiz-only slug/name conversion logic.
  const [selected, setSelected] = useState<string[]>(() =>
    resolveCategoryNames(initialSelectedCategories, categoryList),
  );

  return (
    <div className={styles.categoriesSection}>
      {/* # CHANGED THIS - restore saved lists on /quiz while preserving the existing search/create/modal picker UI. */}
      <CategoryPicker
        selectedCategories={selected}
        onChange={setSelected}
        savedLists
        selectAll
      />

      {/* # CHANGED THIS - preserve the large mobile touch target while allowing desktop to size this as a compact action. */}
      <div className={`${sharedStyles.actionCluster} ${styles.applyRow}`}>
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonTouchSm} ${sharedStyles.buttonWrap} ${sharedStyles.btnBlue} ${styles.applyButton}`}
          disabled={disabled}
          onClick={() => onApply?.(selected)}
        >
          Apply Categories
        </button>
      </div>
    </div>
  );
}
