import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BookOpen, ListChecks, Save, Search } from "lucide-react";
import { QueFilters } from "./QueFilters";
import { QueResultsList, type QueCardActions } from "./QueResultsList";
import { blockUser, saveToQue, searchQue } from "./quemore_api";
import { toSlug } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { notify } from "../toast/notify";
import sharedStyles from "../styles/shared.module.css";
import styles from "./QueMore.module.css";
import type {
  QueEndpoints,
  QueFilterState,
  QueSearchResult,
  SavePayload,
} from "./quemore_types";

const DEFAULT_FILTERS: QueFilterState = {
  personal: true,
  favorate: true,
  public: true,
  blocked: false,
  excluded: false,
};

/** The first `qty` results not already excluded: what "Quantity to Add" pre-checks. */
function autoSelect(results: QueSearchResult[], qty: number): Set<number> {
  return new Set(
    results
      .filter((result) => !result.excluded)
      .slice(0, Math.max(qty, 0))
      .map((result) => result.id)
  );
}

/** Queuing a question the reader had excluded takes it off their excluded list. */
function quePayload(results: QueSearchResult[]): SavePayload {
  return {
    que: results.map((result) => result.id),
    unexclude: results.filter((result) => result.excluded).map((result) => result.id),
  };
}

/** A copy of `set` with `id` added if it was missing, removed if it was there. */
function toggled(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

const hasAll = (set: ReadonlySet<number>, ids: number[]) =>
  ids.length > 0 && ids.every((id) => set.has(id));

interface QuePanelProps {
  endpoints: QueEndpoints;
  /** Category names to search; the page decides whether the reader picks them. */
  categories: string[];
}

/**
 * Search, pick and save questions into the reader's que: the whole Que More
 * workflow, short of choosing the categories it searches.
 */
export function QuePanel({ endpoints, categories }: QuePanelProps) {
  const [filters, setFilters] = useState<QueFilterState>(DEFAULT_FILTERS);
  const [qty, setQty] = useState("10");
  const selectionToastId = useId();
  const [queuedCount, setQueuedCount] = useState(0);

  const [results, setResults] = useState<QueSearchResult[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [found, setFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<number | null>(null);
  const searchVersion = useRef(0);
  const dismissedIds = useRef(new Set<number>());

  const runSearch = useCallback(async () => {
    const version = ++searchVersion.current;
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    setExpanded(new Set());

    try {
      const outcome = await searchQue(
        endpoints.searchUrl,
        filters,
        categories.map(toSlug)
      );

      if (version !== searchVersion.current) return;
      const available = outcome.results.filter((result) => !dismissedIds.current.has(result.id));
      setHasSearched(true);
      setFound(outcome.ok);
      setResults(available);
      setSelected(autoSelect(available, Number(qty)));

      if (outcome.msg) notify[outcome.msgCategory](outcome.msg);
    } catch (err) {
      setFound(false);
      notify.error(errorMessage(err, "Search failed."));
    } finally {
      setSearching(false);
    }
  }, [endpoints, categories, filters, qty]);

  const resultIds = useMemo(() => results.map((result) => result.id), [results]);

  /** A result already excluded is left out of "Select All", as it is of `autoSelect`. */
  const queableIds = useMemo(
    () => results.filter((result) => !result.excluded).map((result) => result.id),
    [results]
  );

  const chosen = useMemo(
    () => results.filter((result) => selected.has(result.id)),
    [results, selected]
  );

  const allSelected = hasAll(selected, queableIds);
  const allExpanded = hasAll(expanded, resultIds);

  useEffect(() => {
    if (!found) return void notify.dismiss(selectionToastId);
    notify.info(
      `${chosen.length} selected to add to your que. Press Save above to queue the selected questions. ${queuedCount} queued this visit.`,
      { id: selectionToastId, persistent: true }
    );
  }, [chosen.length, queuedCount, found, selectionToastId]);

  useEffect(() => () => { notify.dismiss(selectionToastId); }, [selectionToastId]);

  /** The quantity is what picks the rows, so editing it re-picks them. */
  const handleQtyChange = useCallback(
    (value: string) => {
      setQty(value);
      setSelected(autoSelect(results, Number(value)));
    },
    [results]
  );

  /** One write to the que, reported either way; true when it went through. */
  const commit = useCallback(
    async (payload: SavePayload) => {
      try {
        notify.success(await saveToQue(endpoints.saveUrl, payload));
        setQueuedCount((count) => count + (payload.que?.length ?? 0));
        return true;
      } catch (err) {
        notify.error(errorMessage(err, "Could not save."));
        return false;
      }
    },
    [endpoints]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    // The saved questions are no longer eligible; refresh against the server.
    if (await commit(quePayload(chosen))) await runSearch();
    setSaving(false);
  }, [chosen, commit, runSearch]);

  /** Que or exclude one question on the spot; either way it leaves the results. */
  const settle = useCallback(
    async (result: QueSearchResult, payload: SavePayload) => {
      if (dismissedIds.current.has(result.id)) return;
      dismissedIds.current.add(result.id);
      const version = searchVersion.current;
      const index = results.indexOf(result);
      setActingId(result.id);
      setResults((prev) => prev.filter((other) => other.id !== result.id));
      if (!await commit(payload)) {
        dismissedIds.current.delete(result.id);
        if (version === searchVersion.current) setResults((prev) => prev.some((other) => other.id === result.id)
          ? prev
          : [...prev.slice(0, index), result, ...prev.slice(index)]);
      }
      setActingId((id) => id === result.id ? null : id);
    },
    [commit, results]
  );

  const handleBlock = useCallback(async ({ created_by: userId, username }: QueSearchResult) => {
    setBlockingUserId(userId);
    try {
      await blockUser(endpoints.blockUserUrl, userId);
      setResults((prev) => prev.filter((result) => result.created_by !== userId));
      notify.success(`Blocked ${username}.`);
    } catch (err) {
      notify.error(errorMessage(err, "Could not block user."));
    } finally {
      setBlockingUserId(null);
    }
  }, [endpoints]);

  const cardActions = useMemo<QueCardActions>(
    () => ({
      onSelect: (result) => setSelected((prev) => toggled(prev, result.id)),
      onToggle: (result) => setExpanded((prev) => toggled(prev, result.id)),
      onQueNow: (result) => void settle(result, quePayload([result])),
      onExclude: (result) => void settle(result, { exclude: [result.id] }),
      onBlock: (result) => void handleBlock(result),
    }),
    [settle, handleBlock]
  );

  return (
    <>
      <section className={styles.searchPanel}>
        <QueFilters filters={filters} onChange={setFilters} />

        <div className={styles.controlRow}>
          <button
            type="button"
            className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
            onClick={() => void runSearch()}
            disabled={searching}
          >
            <Search className={sharedStyles.buttonIcon} />
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
              onChange={(event) => handleQtyChange(event.target.value)}
            />
          </label>

          <button
            type="button"
            className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
            onClick={() => void handleSave()}
            disabled={saving || chosen.length === 0}
          >
            <Save className={sharedStyles.buttonIcon} />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </section>

      <section className={styles.results}>
        <header className={styles.resultsHeader}>
          <h2 className={styles.resultsTitle}>Que Search Results</h2>
          {results.length > 0 && (
            <div className={styles.resultsActions}>
              <p className={styles.resultsSummary}>
                {results.length} found &middot; {chosen.length} to add
              </p>
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                  allExpanded ? sharedStyles.btnSlate : sharedStyles.btnBlue
                }`}
                onClick={() => setExpanded(new Set(allExpanded ? [] : resultIds))}
              >
                <BookOpen className={sharedStyles.buttonIcon} />
                <span>{allExpanded ? "Collapse All Questions" : "Expand All Questions"}</span>
              </button>
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${
                  allSelected ? sharedStyles.btnSlate : sharedStyles.btnCyan
                }`}
                onClick={() => setSelected(new Set(allSelected ? [] : queableIds))}
                disabled={queableIds.length === 0}
              >
                <ListChecks className={sharedStyles.buttonIcon} />
                <span>{allSelected ? "Clear All" : "Select All"}</span>
              </button>
            </div>
          )}
        </header>

        {results.length > 0 ? (
          <QueResultsList
            results={results}
            selected={selected}
            expanded={expanded}
            actingId={actingId}
            blockingUserId={blockingUserId}
            actions={cardActions}
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
    </>
  );
}
