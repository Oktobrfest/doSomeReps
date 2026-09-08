import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Star, Trash2, X } from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { toSlug } from "../lib/categories";
import styles from "./CategoryPicker.module.css";

interface CategoryList {
  id: number;
  name: string;
  is_default: boolean;
  categories: string[];
}

interface CategoryPickerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  /** Saved-list dropdown plus create/rename/delete/set-default actions. */
  showSavedLists?: boolean;
  /** Select All / Deselect All toggle and the selection counter. */
  showSelectAll?: boolean;
  /** Optional heading. Omit when the parent already labels the section. */
  title?: string;
  /** Input name attribute. Required for server-rendered form submission. */
  checkboxName?: string;
  /** Maps a category name onto the value the server expects. */
  checkboxValueFn?: (category: string) => string;
  /** Submit button that posts apply-categories=Apply with the surrounding form. */
  showApplyButton?: boolean;
  /** Hides the picker without unmounting, so checked inputs still submit. */
  collapsed?: boolean;
}

const sameSelection = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const left = new Set(a.map(toSlug));
  return b.every((item) => left.has(toSlug(item)));
};

export function CategoryPicker({
  selectedCategories,
  onChange,
  showSavedLists = true,
  showSelectAll = true,
  title,
  checkboxName,
  checkboxValueFn,
  showApplyButton = false,
  collapsed,
}: CategoryPickerProps) {
  const allCategories = useCategories();

  const [savedLists, setSavedLists] = useState<CategoryList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...allCategories].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
      ),
    [allCategories]
  );

  const selectedSet = useMemo(
    () => new Set(selectedCategories),
    [selectedCategories]
  );

  const selectedList = useMemo(
    () => savedLists.find((list) => list.id.toString() === selectedListId),
    [savedLists, selectedListId]
  );

  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(selectedList) &&
      !sameSelection(selectedList!.categories, selectedCategories),
    [selectedList, selectedCategories]
  );

  // Saved-list category names come back from the API; map them onto the canonical
  // names in the category table so selection comparisons stay consistent.
  const resolveNames = useCallback(
    (names: string[]): string[] =>
      names.map(
        (name) => sorted.find((cat) => toSlug(cat) === toSlug(name)) ?? name
      ),
    [sorted]
  );

  useEffect(() => {
    if (!showSavedLists) return;
    let cancelled = false;

    fetch("/api/category-lists")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load saved lists.");
        return res.json() as Promise<CategoryList[]>;
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setSavedLists(data);

        const match = data.find((list) =>
          sameSelection(list.categories, selectedCategories)
        );
        if (match) {
          setSelectedListId(match.id.toString());
          return;
        }

        const fallback = data.find((list) => list.is_default);
        if (fallback && selectedCategories.length === 0) {
          setSelectedListId(fallback.id.toString());
          onChange(resolveNames(fallback.categories));
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
    // Runs once: this is initial hydration, not a subscription to the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSavedLists]);

  const toggle = (category: string) =>
    onChange(
      selectedSet.has(category)
        ? selectedCategories.filter((item) => item !== category)
        : [...selectedCategories, category]
    );

  const toggleAll = () =>
    onChange(selectedCategories.length === sorted.length ? [] : [...sorted]);

  const handleListChange = (listId: string) => {
    setSelectedListId(listId);
    const list = savedLists.find((item) => item.id.toString() === listId);
    onChange(list ? resolveNames(list.categories) : []);
  };

  const handleCreate = () => {
    const name = newListName.trim();
    if (!name) return;

    if (savedLists.some((list) => list.name.trim().toLowerCase() === name.toLowerCase())) {
      setError("A list with that name already exists.");
      return;
    }

    setError(null);
    setIsSaving(true);

    fetch("/api/category-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        categories: selectedCategories,
        is_default: savedLists.length === 0,
      }),
    })
      .then((res) => res.json())
      .then((created: CategoryList & { error?: string }) => {
        if (created.error) throw new Error(created.error);
        setSavedLists((prev) =>
          created.is_default
            ? [...prev.map((l) => ({ ...l, is_default: false })), created]
            : [...prev, created]
        );
        setSelectedListId(created.id.toString());
        setNewListName("");
        setIsCreateMode(false);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsSaving(false));
  };

  const handleSaveChanges = () => {
    if (!selectedListId) return;
    setError(null);
    setIsSaving(true);

    fetch(`/api/category-lists/${selectedListId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: selectedCategories }),
    })
      .then((res) => res.json())
      .then((updated: CategoryList & { error?: string }) => {
        if (updated.error) throw new Error(updated.error);
        setSavedLists((prev) =>
          prev.map((list) => (list.id === updated.id ? updated : list))
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsSaving(false));
  };

  const handleDelete = () => {
    if (!selectedListId) return;
    setError(null);

    fetch(`/api/category-lists/${selectedListId}`, { method: "DELETE" })
      .then((res) => res.json())
      .then((data: { success?: boolean; error?: string }) => {
        if (!data.success) throw new Error(data.error ?? "Failed to delete list.");
        setSavedLists((prev) =>
          prev.filter((list) => list.id.toString() !== selectedListId)
        );
        setSelectedListId("");
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleSetDefault = () => {
    if (!selectedListId) return;
    setError(null);

    fetch(`/api/category-lists/${selectedListId}/set-default`, { method: "POST" })
      .then((res) => res.json())
      .then((data: { success?: boolean; error?: string }) => {
        if (!data.success) throw new Error(data.error ?? "Failed to set default.");
        setSavedLists((prev) =>
          prev.map((list) => ({
            ...list,
            is_default: list.id.toString() === selectedListId,
          }))
        );
      })
      .catch((err: Error) => setError(err.message));
  };

  const allSelected = sorted.length > 0 && selectedCategories.length === sorted.length;

  return (
    <div hidden={collapsed} className={styles.picker}>
      {title && (
        <header className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </header>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {showSavedLists && (
        <div className={styles.toolbar}>
          {isCreateMode ? (
            <>
              <input
                type="text"
                className={styles.input}
                placeholder="Save selection as..."
                value={newListName}
                autoFocus
                onChange={(event) => setNewListName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleCreate();
                  if (event.key === "Escape") setIsCreateMode(false);
                }}
              />
              <button
                type="button"
                className={styles.btn}
                onClick={handleCreate}
                disabled={isSaving || !newListName.trim() || selectedCategories.length === 0}
              >
                <Check className={styles.btnIcon} />
                <span>Save list</span>
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setIsCreateMode(false);
                  setNewListName("");
                }}
              >
                <X className={styles.btnIcon} />
                <span>Cancel</span>
              </button>
            </>
          ) : (
            <>
              <select
                className={styles.select}
                value={selectedListId}
                onChange={(event) => handleListChange(event.target.value)}
                aria-label="Saved category list"
              >
                <option value="">— Saved lists —</option>
                {savedLists.map((list) => (
                  <option key={list.id} value={list.id.toString()}>
                    {list.name}
                    {list.is_default ? " ★" : ""}
                  </option>
                ))}
              </select>

              {selectedListId && hasUnsavedChanges && (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  title="Save the current selection to this list"
                >
                  <Check className={styles.btnIcon} />
                  <span>Save changes</span>
                </button>
              )}

              {selectedListId && (
                <>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={handleSetDefault}
                    title="Set as default list"
                  >
                    <Star className={styles.btnIcon} />
                    <span>Default</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={handleDelete}
                    title="Delete this list"
                  >
                    <Trash2 className={styles.btnIcon} />
                    <span>Delete</span>
                  </button>
                </>
              )}

              <span className={styles.divider} />

              <button
                type="button"
                className={styles.btn}
                onClick={() => setIsCreateMode(true)}
              >
                <Plus className={styles.btnIcon} />
                <span>New list</span>
              </button>
            </>
          )}
        </div>
      )}

      <ul className={styles.grid}>
        {sorted.length === 0 && <p className={styles.empty}>No categories yet.</p>}
        {sorted.map((category) => {
          const checked = selectedSet.has(category);
          return (
            <li
              key={category}
              className={`${styles.item} ${checked ? styles.itemChecked : ""}`}
              onClick={() => toggle(category)}
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={checked}
                onChange={() => toggle(category)}
                onClick={(event) => event.stopPropagation()}
                aria-label={category}
                name={checkboxName}
                value={checkboxValueFn ? checkboxValueFn(category) : category}
              />
              <span
                className={`${styles.itemLabel} ${checked ? styles.itemLabelChecked : ""}`}
                title={category}
              >
                {category}
              </span>
            </li>
          );
        })}
      </ul>

      {(showSelectAll || showApplyButton) && (
        <div className={styles.footer}>
          {showSelectAll ? (
            <button type="button" className={styles.btn} onClick={toggleAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          ) : (
            <span className={styles.spacer} />
          )}

          {showApplyButton && (
            <button
              type="submit"
              name="apply-categories"
              value="Apply"
              className={styles.btn}
            >
              Apply
            </button>
          )}

          <span className={styles.count}>
            {selectedCategories.length} of {sorted.length} selected
          </span>
        </div>
      )}
    </div>
  );
}
