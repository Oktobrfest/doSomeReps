import { useState } from 'react';
import { CategoryPicker } from '../../components/CategoryPicker';
import { QuizModal } from '../../components/QuizModal';
import { resolveCategoryNames } from '../../lib/categories';
import sharedStyles from '../../styles/shared.module.css';
import styles from './modalContent.module.css';

interface CategoriesModalProps {
  categoryList?: string[];
  selectedCategories?: string[];
  onApply: (categories: string[]) => void;
  onClose: () => void;
}

/**
 * Category picker for the empty-queue screen.
 *
 * With no question on screen there is no slide-out panel to hold the picker,
 * and choosing different categories is exactly what a reader with an empty
 * queue needs to do.
 */
export function CategoriesModal({
  categoryList = [],
  selectedCategories = [],
  onApply,
  onClose,
}: CategoriesModalProps) {
  // # CHANGED THIS - the modal uses the same shared name/slug normalization as every other category consumer.
  const [selected, setSelected] = useState<string[]>(() =>
    resolveCategoryNames(selectedCategories, categoryList),
  );

  return (
    <QuizModal title="Select Categories" onClose={onClose}>
      {/* # CHANGED THIS - empty-queue category selection now has the same saved lists and picker implementation as /quiz. */}
      <CategoryPicker
        selectedCategories={selected}
        onChange={setSelected}
        savedLists
        selectAll
      />

      <button
        type="button"
        className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue} ${styles.trailingAction}`}
        onClick={() => {
          onApply(selected);
          onClose();
        }}
      >
        Apply Categories
      </button>
    </QuizModal>
  );
}
