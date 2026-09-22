import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "../hooks/useCategories";
import { useFullSizedPage } from "../hooks/useFullSizedPage";
import { byName, createCategory } from "../lib/categories";
import { CategoryChip } from "./CategoryChip";
import { CategorySection, type CategoryItem } from "./CategorySection";
import { QuizModal } from "./QuizModal";
import { SavedCategoryLists } from "./SavedCategoryLists";
import styles from "./CategoryPicker.module.css";

/** How long a chip wears its new tick before it moves to the other section. */
const MOVE_MS = 300;

/**
 * Whether `content` still fits the width `host` has for it.
 *
 * `content` is laid out at its max-content width whichever answer comes back,
 * so the measurement never depends on the answer and cannot oscillate between
 * the two of them.
 */
function useFitsInline(
  host: RefObject<HTMLElement>,
  content: RefObject<HTMLElement>,
  key: string
): boolean {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const hostEl = host.current;
    const contentEl = content.current;
    if (!hostEl || !contentEl) return;

    const measure = () => setFits(contentEl.offsetWidth <= hostEl.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(hostEl);
    return () => observer.disconnect();
  }, [host, content, key]);

  return fits;
}

export interface CategoryPickerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  /** Saved lists: for the many categories a quiz or a search is drawn from. */
  savedLists?: boolean;
  /** Creating a category: only where new questions are written. */
  allowCreate?: boolean;
  /** Select all: only where wanting every category is a real thing to want. */
  selectAll?: boolean;
  /**
   * Whether the disclosure starts open on a full-sized page. A page that has
   * somewhere else to set categories leaves this closed; a page where picking
   * one is the next thing a writer does opens it. A phone ignores it: there
   * the picker is a sheet, and opening it unasked would cover the page.
   */
  defaultExpanded?: boolean;
}

/**
 * Every category, split into the ones picked and the ones not.
 *
 * The two halves are the same section rendered twice, the filter narrows only
 * the half a reader is choosing from, and what a page does not need it does
 * not get: no page grows a picker of its own.
 *
 * It costs a lot of room, so it is gated either way: a full-sized page keeps
 * it behind one bar, and a phone, which has no room to hold it beside anything
 * else, keeps it behind one button that gives it the whole screen.
 */
export function CategoryPicker({
  selectedCategories,
  onChange,
  savedLists = false,
  allowCreate = false,
  selectAll = false,
  defaultExpanded = false,
}: CategoryPickerProps) {
  const known = useCategories();
  const fullSized = useFullSizedPage();
  const [filter, setFilter] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!moving) return;
    const timer = window.setTimeout(() => setMoving(null), MOVE_MS);
    return () => window.clearTimeout(timer);
  }, [moving]);

  /* A selection can name a category the table no longer has, after a rename or
     a delete. It stays in the list so a reader can still untick it. */
  const categories = useMemo(
    () => [...new Set([...known, ...selectedCategories])].sort(byName),
    [known, selectedCategories]
  );
  const chosen = useMemo(() => new Set(selectedCategories), [selectedCategories]);

  /* The moving chip holds the section it came from until its tick has landed. */
  const isSelected = (name: string) => (name === moving ? !chosen.has(name) : chosen.has(name));
  const item = (name: string): CategoryItem => ({
    name,
    checked: chosen.has(name),
    moving: name === moving,
  });

  const needle = filter.trim().toLowerCase();
  const selected = categories.filter(isSelected).map(item);
  const unselected = categories
    .filter((name) => !isSelected(name) && name.toLowerCase().includes(needle))
    .map(item);
  const everythingChosen = categories.length > 0 && categories.every(isSelected);

  const toggle = (name: string) => {
    setMoving(name);
    onChange(chosen.has(name) ? selectedCategories.filter((c) => c !== name) : [...selectedCategories, name]);
  };

  /* A wholesale action answers the whole list, so it leaves no filter behind
     narrowing what comes back. */
  const applyBulk = (next: string[]) => {
    setMoving(null);
    setFilter("");
    onChange(next);
  };

  const wanted = filter.trim();
  const creatable =
    allowCreate && wanted.length > 0 && !categories.some((name) => name.toLowerCase() === needle);

  const create = async () => {
    if (!creatable || creating) return;
    setCreating(true);
    try {
      const name = await createCategory(wanted);
      if (!chosen.has(name)) onChange([...selectedCategories, name]);
      setFilter("");
      toast.success(`Category "${name}" created.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create that category.");
    } finally {
      setCreating(false);
    }
  };

  const picker = (
    <div className={styles.picker}>
      {savedLists && (
        <div className={styles.savedLists}>
          <SavedCategoryLists
            categories={categories}
            selected={selectedCategories}
            onChange={onChange}
          />
        </div>
      )}

      {/* With nothing left to choose from there is nothing left to narrow. */}
      {!everythingChosen && (
        <div className={styles.filterRow}>
          <div className={styles.field}>
            <input
              type="text"
              className={styles.input}
              aria-label="Filter categories"
              placeholder={allowCreate ? "Filter categories, or name a new one..." : "Filter categories..."}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void create();
              }}
            />
            {filter !== "" && (
              <button
                type="button"
                className={styles.clear}
                aria-label="Clear filter"
                onClick={() => setFilter("")}
              >
                <X className={styles.clearIcon} />
              </button>
            )}
          </div>

          {creatable && (
            <button type="button" className={styles.create} disabled={creating} onClick={() => void create()}>
              <Plus className={styles.createIcon} />
              <span>{creating ? "Adding..." : `Create "${wanted}"`}</span>
            </button>
          )}
        </div>
      )}

      <CategorySection
        title="Unselected categories"
        items={unselected}
        onToggle={toggle}
        highlight={wanted}
        bulk={selectAll ? { label: "Select all", onClick: () => applyBulk(categories) } : undefined}
        empty={
          everythingChosen ? (
            <p className={styles.empty}>Every category is selected.</p>
          ) : (
            <p className={styles.empty}>
              <span>No unselected category matches “{wanted}”.</span>
              <button type="button" className={styles.emptyAction} onClick={() => setFilter("")}>
                Clear search filter
              </button>
            </p>
          )
        }
      />

      <CategorySection
        title="Selected categories"
        items={selected}
        onToggle={toggle}
        highlight={wanted}
        bulk={{ label: "Clear all selected", onClick: () => applyBulk([]) }}
        empty={<p className={styles.empty}>Nothing selected yet. Tick a category above.</p>}
      />
    </div>
  );

  const tally = selectedCategories.length > 0 ? ` (${selectedCategories.length})` : "";

  if (fullSized) {
    return (
      <div className={styles.disclosure}>
        <div className={styles.summary}>
          <button
            type="button"
            className={`${styles.toggle} ${expanded ? styles.toggleOpen : ""}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            Categories{tally}
          </button>

          {/* Closed, the bar still says which ones: as chips a reader can untick
              where they fit, and as a plain list where they do not. */}
          {!expanded && selected.length > 0 && (
            <Preview items={selected} onToggle={toggle} />
          )}
        </div>

        {expanded && <div className={styles.disclosureBody}>{picker}</div>}
      </div>
    );
  }

  return (
    <>
      <button type="button" className={styles.openSheet} onClick={() => setSheetOpen(true)}>
        Select Categories{tally}
      </button>

      {sheetOpen && (
        <QuizModal title="Categories" fullScreen onClose={() => setSheetOpen(false)}>
          {picker}
        </QuizModal>
      )}
    </>
  );
}

interface PreviewProps {
  items: CategoryItem[];
  onToggle: (name: string) => void;
}

/** What is picked, shown in whichever form the bar has room for. */
function Preview({ items, onToggle }: PreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLSpanElement>(null);
  const names = items.map((item) => item.name);
  const fits = useFitsInline(hostRef, chipsRef, names.join("\u0000"));

  return (
    <div className={styles.preview} ref={hostRef}>
      <span
        ref={chipsRef}
        className={`${styles.previewChips} ${fits ? "" : styles.offstage}`}
      >
        {items.map((item) => (
          <CategoryChip key={item.name} {...item} onToggle={onToggle} />
        ))}
      </span>

      {!fits && (
        <span className={styles.previewText}>
          (
          <span className={styles.previewNames}>{names.join(", ")}</span>
          )
        </span>
      )}
    </div>
  );
}
