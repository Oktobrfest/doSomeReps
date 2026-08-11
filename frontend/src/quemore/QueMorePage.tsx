import { useCallback, useMemo, useState } from "react";
import { Search, Save } from "lucide-react";
import { Toaster, toast } from "sonner";
import { CategoryPicker } from "../components/CategoryPicker";
import { QueFilters } from "./QueFilters";
import { QueResultsTable } from "./QueResultsTable";
import { blockUser, readBootstrap, saveToQue, searchQue } from "./quemore_api";
import sharedStyles from "../styles/shared.module.css";
import styles from "./QueMore.module.css";
import type {
  QueFilterState,
  QueSearchResult,
  RowSelection,
} from "./quemore_types";

const bootstrap = readBootstrap();

const toSlug = (value: string) => value.replace(/ /g, "_");

const DEFAULT_FILTERS: QueFilterState = {
  personal: true,
  favorate: true,
  public: true,
  blocked: false,
  excluded: false,
};

function resolveInitialSelection(): string[] {
  return bootstrap.selectedCategories.map(
    (slug) =>
      bootstrap.categoryList.find((cat) => toSlug(cat) === slug) ??
      slug.replace(/_/g, " ")
  );
}

/**
 * Pre-checks the first `qty` rows that are not already excluded, matching the
 * "Quantity to Add" field the user set before searching.
 */
function autoSelect(
  results: QueSearchResult[],
  qty: number
): Record<number, RowSelection> {
  let remaining = qty;
  const selections: Record<number, RowSelection> = {};

  for (const result of results) {
    const take = !result.excluded && remaining > 0;
    if (take) remaining -= 1;
    selections[result.question_id] = { que: take, exclude: result.excluded };
  }

  return selections;
}

export function QueMorePage() {
  const [categories, setCategories] = useState<string[]>(resolveInitialSelection);
  const [filters, setFilters] = useState<QueFilterState>(DEFAULT_FILTERS);
  const [qty, setQty] = useState(10);

  const [results, setResults] = useState<QueSearchResult[]>([]);
  const [selections, setSelections] = useState<Record<number, RowSelection>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockingUserId, setBlockingUserId] = useState<number | null>(null);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setResults([]);
    setSelections({});

    try {
      const outcome = await searchQue(
        bootstrap.searchUrl,
        filters,
        categories.map(toSlug)
      );

      setHasSearched(true);
      setResults(outcome.results);
      setSelections(autoSelect(outcome.results, qty));

      if (outcome.msg) {
        if (outcome.msgCategory === "error") toast.error(outcome.msg);
        else if (outcome.msgCategory === "warning") toast.warning(outcome.msg);
        else toast.success(outcome.msg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [categories, filters, qty]);

  const toggle = useCallback(
    (questionId: number, field: keyof RowSelection, value: boolean) => {
      setSelections((prev) => {
        const current = prev[questionId] ?? { que: false, exclude: false };
        // Que and exclude are mutually exclusive: checking one clears the other.
        const next: RowSelection =
          field === "que"
            ? { que: value, exclude: value ? false : current.exclude }
            : { exclude: value, que: value ? false : current.que };

        return { ...prev, [questionId]: next };
      });
    },
    []
  );

  const payload = useMemo(() => {
    const que: number[] = [];
    const exclude: number[] = [];
    const unexclude: number[] = [];

    for (const result of results) {
      const selection = selections[result.question_id];
      if (!selection) continue;

      if (selection.que) que.push(result.question_id);
      if (selection.exclude && !result.excluded) exclude.push(result.question_id);
      if (!selection.exclude && result.excluded) unexclude.push(result.question_id);
    }

    return { que, exclude, unexclude };
  }, [results, selections]);

  const nothingToSave =
    payload.que.length === 0 &&
    payload.exclude.length === 0 &&
    payload.unexclude.length === 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const msg = await saveToQue(bootstrap.saveUrl, payload);
      toast.success(msg);
      // The saved questions are no longer eligible; refresh against the server.
      await runSearch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [payload, runSearch]);

  const handleBlock = useCallback(async (userId: number, username: string) => {
    setBlockingUserId(userId);
    try {
      await blockUser(bootstrap.blockUserUrl, userId);
      setResults((prev) => prev.filter((result) => result.created_by !== userId));
      toast.success(`Blocked ${username}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not block user.");
    } finally {
      setBlockingUserId(null);
    }
  }, []);

  return (
    <div className={styles.page}>
      <Toaster richColors position="top-right" />

      <h1 className={styles.pageTitle}>Que More Questions</h1>

      <CategoryPicker
        selectedCategories={categories}
        onChange={setCategories}
        showSavedLists={true}
        showSelectAll={true}
      />

      <QueFilters filters={filters} onChange={setFilters} />

      <div className={styles.controlRow}>
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
          onClick={() => void runSearch()}
          disabled={searching}
        >
          <Search size={18} />
          <span>{searching ? "Searching..." : "Search"}</span>
        </button>

        <label className={styles.qtyLabel} htmlFor="qty_to_que">
          Quantity to Add:
          <input
            type="number"
            id="qty_to_que"
            className={styles.qtyInput}
            min={0}
            max={999999}
            value={qty}
            onChange={(event) => setQty(Number(event.target.value) || 0)}
          />
        </label>

        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
          onClick={() => void handleSave()}
          disabled={saving || nothingToSave}
        >
          <Save size={18} />
          <span>{saving ? "Saving..." : "Save"}</span>
        </button>
      </div>

      <section className={styles.results}>
        <h2 className={styles.resultsTitle}>Que Search Results</h2>

        {results.length > 0 ? (
          <QueResultsTable
            results={results}
            selections={selections}
            onToggle={toggle}
            onBlock={(userId, username) => void handleBlock(userId, username)}
            blockingUserId={blockingUserId}
          />
        ) : (
          <p className={styles.empty}>
            {searching
              ? "Searching..."
              : hasSearched
                ? "No questions matched. Try selecting more categories."
                : "Pick categories and filters, then search."}
          </p>
        )}
      </section>
    </div>
  );
}
