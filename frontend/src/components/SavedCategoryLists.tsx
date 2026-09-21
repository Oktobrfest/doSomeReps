import { useEffect, useMemo, useState } from "react";
import { resolveCategoryNames, toSlug } from "../lib/categories";
import { csrfHeaders, jsonHeaders } from "../lib/http";
import styles from "./CategoryPicker.module.css";

// # CHANGED THIS - saved-list persistence is one focused component, not a second picker or a hook/controller/component stack.
interface CategoryList {
  id: number;
  name: string;
  is_default: boolean;
  categories: string[];
}

interface SavedCategoryListsProps {
  categories: string[];
  selected: string[];
  onChange: (categories: string[]) => void;
}

const sameSelection = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const selected = new Set(left.map(toSlug));
  return right.every((category) => selected.has(toSlug(category)));
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Category list request failed.");
  return data;
}

export function SavedCategoryLists({
  categories,
  selected,
  onChange,
}: SavedCategoryListsProps) {
  const [lists, setLists] = useState<CategoryList[]>([]);
  const [activeId, setActiveId] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => lists.find((list) => String(list.id) === activeId),
    [activeId, lists]
  );
  const dirty = Boolean(active && !sameSelection(active.categories, selected));
  const resolve = (values: string[]) => categories.length > 0 ? resolveCategoryNames(values, categories) : values;

  // # CHANGED THIS - only initial hydration can auto-apply the default, and only when the caller supplied no selection.
  useEffect(() => {
    let cancelled = false;
    void requestJson<CategoryList[]>("/api/category-lists")
      .then((loaded) => {
        if (cancelled || !Array.isArray(loaded)) return;
        setLists(loaded);
        const match = loaded.find((list) => sameSelection(list.categories, selected));
        const initial = match ?? (selected.length === 0 ? loaded.find((list) => list.is_default) : undefined);
        if (!initial) return;
        setActiveId(String(initial.id));
        if (!match) onChange(resolve(initial.categories));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load saved lists.");
      });
    return () => {
      cancelled = true;
    };
    // Initial hydration intentionally ignores later selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Category list request failed.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: string) => {
    setActiveId(id);
    const list = lists.find((item) => String(item.id) === id);
    onChange(list ? resolve(list.categories) : []);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || selected.length === 0) return;
    if (lists.some((list) => list.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError("A list with that name already exists.");
      return;
    }

    await run(async () => {
      const created = await requestJson<CategoryList>("/api/category-lists", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ name: trimmed, categories: selected, is_default: lists.length === 0 }),
      });
      setLists((current) => created.is_default
        ? [...current.map((list) => ({ ...list, is_default: false })), created]
        : [...current, created]);
      setActiveId(String(created.id));
      setName("");
      setCreating(false);
    });
  };

  const save = () => active && run(async () => {
    const updated = await requestJson<CategoryList>(`/api/category-lists/${active.id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ categories: selected }),
    });
    setLists((current) => current.map((list) => list.id === updated.id ? updated : list));
  });

  const makeDefault = () => active && run(async () => {
    await requestJson(`/api/category-lists/${active.id}/set-default`, {
      method: "POST",
      headers: csrfHeaders(),
    });
    setLists((current) => current.map((list) => ({ ...list, is_default: list.id === active.id })));
  });

  const remove = () => active && run(async () => {
    await requestJson(`/api/category-lists/${active.id}`, {
      method: "DELETE",
      headers: csrfHeaders(),
    });
    setLists((current) => current.filter((list) => list.id !== active.id));
    setActiveId("");
  });

  // # CHANGED THIS - every action operates on the caller's live selection; there is no duplicate selection state to drift out of sync.
  // # CHANGED THIS - saved-list actions stay visually subordinate: orange for create, soft semantic treatments for save/default/delete, neutral cancel.
  return (
    <>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.toolbar}>
        {creating ? (
          <>
            <input
              className={styles.toolbarInput}
              value={name}
              placeholder="Save selection as..."
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void create();
                } else if (event.key === "Escape") {
                  setCreating(false);
                  setName("");
                }
              }}
            />
            <button type="button" className={styles.btnSuccess} disabled={busy || !name.trim() || selected.length === 0} onClick={() => void create()}>
              Save list
            </button>
            <button type="button" className={styles.btnCancel} disabled={busy} onClick={() => { setCreating(false); setName(""); }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <select className={styles.select} value={activeId} disabled={busy} onChange={(event) => choose(event.target.value)} aria-label="Saved category list">
              <option value="">— Saved lists —</option>
              {lists.map((list) => (
                <option key={list.id} value={String(list.id)}>{list.name}{list.is_default ? " (Default)" : ""}</option>
              ))}
            </select>
            {dirty && <button type="button" className={styles.btnSuccess} disabled={busy} onClick={() => void save()}>Save changes</button>}
            {active && !active.is_default && <button type="button" className={styles.btnDefault} disabled={busy} onClick={() => void makeDefault()}>Default</button>}
            {active && <button type="button" className={styles.btnDanger} disabled={busy} onClick={() => void remove()}>Delete</button>}
            <button type="button" className={styles.btn} disabled={busy} onClick={() => setCreating(true)}>New list</button>
          </>
        )}
      </div>
    </>
  );
}
