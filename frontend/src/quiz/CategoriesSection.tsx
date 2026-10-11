import { CategoryPicker, type CategoryPickerProps } from '../components/CategoryPicker';
import styles from './CategoriesSection.module.css';

/** One controlled selection, kept mounted across questions and empty queues. */
export function CategoriesSection(props: Pick<CategoryPickerProps, 'selectedCategories' | 'onChange' | 'onOpenChange'>) {
  return (
    <div className={styles.categoriesSection}>
      <CategoryPicker {...props} savedLists selectAll />
    </div>
  );
}
