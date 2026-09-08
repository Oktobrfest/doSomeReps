import { useState } from 'react';
import { CatPicker } from '../../components/CatPicker';
import { QuizModal } from '../../components/QuizModal';
import sharedStyles from '../../styles/shared.module.css';
import styles from './modalContent.module.css';

interface CategoriesModalProps {
  categoryList?: string[];
  selectedCategories?: string[];
  onApply: (categories: string[]) => void;
  onClose: () => void;
}

function normalise(initial?: string[], all?: string[]) {
  if (!initial) return [];

  const known = new Set(all ?? []);

  return initial.map((raw) => (known.has(raw) ? raw : raw.replace(/_/g, ' ')));
}

/**
 * Category picker for the empty-queue screen.
 *
 * With no question on screen there is no slide-out panel to hold the picker,
 * and choosing different categories is exactly what a reader with an empty
 * queue needs to do.
 */
export function CategoriesModal({
  categoryList,
  selectedCategories,
  onApply,
  onClose,
}: CategoriesModalProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    normalise(selectedCategories, categoryList),
  );

  return (
    <QuizModal title="Select Categories" onClose={onClose}>
      <CatPicker selectedCategories={selected} onChange={setSelected} />

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
