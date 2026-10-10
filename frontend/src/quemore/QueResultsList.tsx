import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Ban, ListPlus, Maximize2, UserX } from "lucide-react";
import { CategoryChips } from "../components/CategoryChip";
import { QuizModal } from "../components/QuizModal";
import { useFitSpan, useGridShape, type GridShape } from "../hooks/useCardGrid";
import { QuestionContent } from "../question/QuestionPreview";
import { draftFromPayload } from "../question/question_api";
import { RatingBadge } from "../quiz/RatingStars";
import sharedStyles from "../styles/shared.module.css";
import styles from "./QueMore.module.css";
import type { QueSearchResult } from "./quemore_types";

/** Class list for one control on a card: base + size + intent. */
function cardBtn(intent: string, size = sharedStyles.buttonSm) {
  return `${sharedStyles.actionButton} ${size} ${intent}`;
}

type CardAction = (result: QueSearchResult) => void;

/** What a card asks of the list it sits in. */
export interface QueCardActions {
  onSelect: CardAction;
  onToggle: CardAction;
  onQueNow: CardAction;
  onExclude: CardAction;
  onBlock: CardAction;
}

interface VerdictProps {
  result: QueSearchResult;
  /** A que-now or exclude for this question is in flight. */
  busy: boolean;
  actions: QueCardActions;
}

/** Excludes the question on the spot. Compact, it fits the card's top edge. */
function ExcludeButton({ result, busy, actions, compact = false }: VerdictProps & { compact?: boolean }) {
  return (
    <button
      type="button"
      className={cardBtn(sharedStyles.btnRed, compact ? sharedStyles.buttonXs : sharedStyles.buttonSm)}
      onClick={() => actions.onExclude(result)}
      disabled={busy || result.excluded}
    >
      <Ban className={sharedStyles.buttonIcon} />
      <span>{result.excluded ? "Excluded" : "Exclude"}</span>
    </button>
  );
}

/** The two verdicts a question's full view gives on the spot. */
function Verdicts({ result, busy, actions }: VerdictProps) {
  return (
    <div className={sharedStyles.actionRow}>
      <button
        type="button"
        className={cardBtn(sharedStyles.btnCyan)}
        onClick={() => actions.onQueNow(result)}
        disabled={busy}
      >
        <ListPlus className={sharedStyles.buttonIcon} />
        <span>Que Now</span>
      </button>

      <ExcludeButton result={result} busy={busy} actions={actions} />
    </div>
  );
}

interface QueCardProps {
  result: QueSearchResult;
  /** Checked, waiting for the Save above. */
  selected: boolean;
  /** Grown to show its hint and answer. */
  expanded: boolean;
  busy: boolean;
  blocking: boolean;
  shape: GridShape;
  actions: QueCardActions;
  onView: CardAction;
}

/**
 * One question. Closed, it fills one cell of the grid with as much of the
 * question as fits over its answer's header. Opened by that header, it grows a
 * cell at a time, to at most four, until its question, hint and answer all
 * show, covering the cards after it, which flow on past it.
 */
function QueCard({
  result,
  selected,
  expanded,
  busy,
  blocking,
  shape,
  actions,
  onView,
}: QueCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const span = useFitSpan(expanded, bodyRef, shape);
  const draft = useMemo(() => draftFromPayload(result), [result]);

  return (
    <li
      className={`${styles.card} ${selected ? styles.cardQued : ""} ${
        result.excluded ? styles.cardExcluded : ""
      }`}
      style={{ "--card-cols": span.cols, "--card-rows": span.rows } as CSSProperties}
    >
      <div className={styles.cardEdge}>
        {selected && (
          <span className={styles.cardNotice}>Press Save above to add to que</span>
        )}
        <ExcludeButton result={result} busy={busy} actions={actions} compact />
        <label className={styles.cardPick} title="Select for Save">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => actions.onSelect(result)}
            aria-label="Select for Save"
          />
        </label>
      </div>

      <div ref={bodyRef} className={`${styles.cardBody} ${expanded ? "" : styles.cardBodyClosed}`}>
        <QuestionContent
          draft={draft}
          disclosure={{
            open: expanded,
            onToggle: () => actions.onToggle(result),
            extra: (
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonXs} ${sharedStyles.buttonRound} ${sharedStyles.btnOverlay} ${styles.viewButton}`}
                onClick={() => onView(result)}
                title="Full question and answer"
                aria-label="Full question and answer"
              >
                <Maximize2 className={sharedStyles.buttonIcon} />
              </button>
            ),
          }}
        />
      </div>

      <div className={styles.cardMeta}>
        <CategoryChips names={result.categories} className={styles.cardTags} />

        <div className={styles.byline}>
          {result.rating ? <RatingBadge value={result.rating} /> : null}
          <span className={styles.author}>by {result.username}</span>
          <button
            type="button"
            className={`${cardBtn(sharedStyles.btnRed)} ${sharedStyles.buttonRound}`}
            onClick={() => actions.onBlock(result)}
            disabled={blocking}
            title={`Block ${result.username}`}
            aria-label={`Block ${result.username}`}
          >
            <UserX className={sharedStyles.buttonIcon} />
          </button>
        </div>
      </div>
    </li>
  );
}

interface QueResultsListProps {
  results: QueSearchResult[];
  selected: ReadonlySet<number>;
  expanded: ReadonlySet<number>;
  actingId: number | null;
  blockingUserId: number | null;
  actions: QueCardActions;
}

/**
 * The questions found, as a grid of equal cells. Checking a card holds it for
 * the Save above; Exclude acts on it at once and takes it off the grid. A card
 * opens in place, or the whole question opens in a dialog.
 */
export function QueResultsList({
  results,
  selected,
  expanded,
  actingId,
  blockingUserId,
  actions,
}: QueResultsListProps) {
  const gridRef = useRef<HTMLUListElement>(null);
  const shape = useGridShape(gridRef);

  const [viewing, setViewing] = useState<QueSearchResult | null>(null);
  const viewingDraft = useMemo(() => viewing && draftFromPayload(viewing), [viewing]);

  // Qued or excluded from its full view, a question leaves the results and
  // takes the view with it; a later search hands back new objects, never this one.
  const viewingOpen = viewing !== null && results.includes(viewing);

  return (
    <>
      <ul
        ref={gridRef}
        className={styles.cardGrid}
        style={{ "--grid-cols": shape.cols } as CSSProperties}
      >
        {results.map((result) => (
          <QueCard
            key={result.id}
            result={result}
            selected={selected.has(result.id)}
            expanded={expanded.has(result.id)}
            busy={actingId === result.id}
            blocking={blockingUserId === result.created_by}
            shape={shape}
            actions={actions}
            onView={setViewing}
          />
        ))}
      </ul>

      {viewingOpen && viewingDraft && (
        <QuizModal title="Question & Answer" onClose={() => setViewing(null)}>
          <QuestionContent draft={viewingDraft} />
          <div className={styles.viewVerdicts}>
            <Verdicts result={viewing} busy={actingId === viewing.id} actions={actions} />
          </div>
        </QuizModal>
      )}
    </>
  );
}
