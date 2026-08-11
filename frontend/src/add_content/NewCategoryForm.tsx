import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES_CHANGED_EVENT } from "../hooks/useCategories";
import { createCategory } from "./add_content_api";
import sharedStyles from "../styles/shared.module.css";
import styles from "./AddContent.module.css";

interface NewCategoryFormProps {
  addCategoryUrl: string;
  /** Called with the canonical name so the caller can pre-select it. */
  onCreated: (categoryName: string) => void;
}

export function NewCategoryForm({ addCategoryUrl, onCreated }: NewCategoryFormProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const created = await createCategory(addCategoryUrl, trimmed);
      setName("");
      // The picker owns the category list; tell it to refetch.
      document.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT));
      onCreated(created);
      toast.success(`Category "${created}" created.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.newCategory}>
      <label className={styles.label} htmlFor="add_category_field">
        Add New Category
      </label>
      <div className={styles.newCategoryRow}>
        <input
          type="text"
          id="add_category_field"
          name="add_category_field"
          className={styles.input}
          value={name}
          disabled={submitting}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // This input lives inside the question form; Enter must not post it.
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnCyan}`}
          onClick={() => void submit()}
          disabled={submitting || !name.trim()}
        >
          <Plus size={16} />
          <span>{submitting ? "Adding..." : "Add"}</span>
        </button>
      </div>
    </div>
  );
}
