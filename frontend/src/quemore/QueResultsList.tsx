import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Ban, ListPlus, Maximize2, User, UserX } from "lucide-react";
import { CategoryChips } from "../components/CategoryChip";
import { QuizModal } from "../components/QuizModal";
import { useGridColumns } from "../hooks/useCardGrid";
import { QuestionPreviewBody } from "../question/QuestionPreview";
import { QuestionPart, QuestionText, QuestionImages, QuestionReadingPart } from "../question/QuestionReading";
import { ImageModal } from "../quiz/ImageModal";
import { draftFromPayload } from "../question/question_api";
import type { QuestionPart as Part } from "../question/question_types";
import { RatingBadge, RatingStars } from "../quiz/RatingStars";
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

/** Excludes the question on the spot; cards use the compact control tier. */
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
  columns: number;
  actions: QueCardActions;
  onView: CardAction;
}

/** A closed card, a two-row hint, or a two-by-two answer. */
function QueCard({
  result,
  selected,
  expanded,
  busy,
  blocking,
  columns,
  actions,
  onView,
}: QueCardProps) {
  const [hintOpen, setHintOpen] = useState(false);
  // Opening the answer (including Expand All) starts with the hint folded away.
  useEffect(() => setHintOpen(false), [expanded]);
  const hasHint = Boolean(result.hint) || Boolean(result.pics_by_type?.hint?.length);
  const draft = useMemo(() => draftFromPayload(result), [result]);

  return (
    <li
      className={`${styles.card} ${selected ? styles.cardQued : ""} ${
        result.excluded ? styles.cardExcluded : ""
      }`}
      style={{ "--card-cols": expanded ? Math.min(2, columns) : 1, "--card-rows": expanded || hintOpen ? 2 : 1 } as CSSProperties}
    >
      <div className={styles.cardEdge}>
        <label className={styles.cardPick} title="Select for Save">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => actions.onSelect(result)}
            aria-label="Select for Save"
          />
        </label>
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

      <div className={`${styles.cardBody} ${expanded || hintOpen ? "" : styles.cardBodyClosed}`}>
        <div className={styles.cardQuestion}>
          <QuestionPreviewBody draft={draft} part="question" />
        </div>
        {hasHint && (expanded || hintOpen) && (
          <QuestionPart part="hint" disclosure={{ open: hintOpen, onToggle: () => setHintOpen((open) => !open) }}>
            <QuestionPreviewBody draft={draft} part="hint" />
          </QuestionPart>
        )}
        {expanded && (
          <QuestionPart part="answer" disclosure={{ open: true, onToggle: () => actions.onToggle(result) }}>
            <QuestionPreviewBody draft={draft} part="answer" />
          </QuestionPart>
        )}
      </div>

      <div className={styles.cardFooter}>
        {!expanded && (
          <>
            {hasHint && (
              <button
                type="button"
                className={cardBtn(sharedStyles.btnCyan)}
                aria-expanded={hintOpen}
                onClick={() => setHintOpen((open) => !open)}
              >Hint</button>
            )}
            <button type="button" className={cardBtn(sharedStyles.btnBlue)} onClick={() => actions.onToggle(result)}>
              Get Answer
            </button>
          </>
        )}
        <ExcludeButton result={result} busy={busy} actions={actions} compact />
        <button
          type="button"
          className={`${cardBtn(sharedStyles.btnOverlay, sharedStyles.buttonXs)} ${sharedStyles.buttonRound} ${styles.viewButton}`}
          onClick={() => onView(result)}
          title="Full question and answer"
          aria-label="Full question and answer"
        >
          <Maximize2 className={sharedStyles.buttonIcon} />
        </button>
      </div>
    </li>
  );
}

/** Full reading view shares the quiz's text, disclosures, carousel and lightbox. */
function FullQuestion({ result, busy, actions, onClose }: VerdictProps & { onClose: () => void }) {
  const [answerOpen, setAnswerOpen] = useState(true);
  const [hintOpen, setHintOpen] = useState(true);
  const [imageView, setImageView] = useState<{ images: string[]; startIndex: number } | null>(null);
  const images = (part: Part) =>
    result.pics_by_type?.[part]?.map((pic) => pic.pic_string) ?? [];
  const openImages = (images: string[], startIndex: number) => setImageView({ images, startIndex });
  const hintImages = images("hint");

  return (
    <>
      <QuizModal
        title="Question details"
        onClose={() => { if (!imageView) onClose(); }}
        header={
          <div className={sharedStyles.actionCluster}>
            <CategoryChips names={result.categories} />
            <span className={styles.byline}>
              <User className={sharedStyles.buttonIcon} />
              <span>{result.username}</span>
            </span>
            <RatingStars
              value={result.rating ?? 0}
              label={result.rating ? `Rated ${result.rating.toFixed(1)} out of 5` : "Not rated yet"}
            />
          </div>
        }
      >
        <QuestionImages images={images("question")} onOpen={openImages} />
        <QuestionText text={result.question_text} />
        {(result.hint || hintImages.length > 0) && (
          <QuestionReadingPart
            part="hint" text={result.hint ?? null} images={hintImages} onOpen={openImages}
            disclosure={{ open: hintOpen, onToggle: () => setHintOpen((open) => !open) }}
          />
        )}
        <QuestionReadingPart
          part="answer" text={result.answer} images={images("answer")} onOpen={openImages}
          disclosure={{ open: answerOpen, onToggle: () => setAnswerOpen((open) => !open) }}
        />
        <div className={styles.viewVerdicts}>
          <Verdicts result={result} busy={busy} actions={actions} />
        </div>
      </QuizModal>
      {imageView && <ImageModal {...imageView} onClose={() => setImageView(null)} />}
    </>
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
  const columns = useGridColumns(gridRef);

  const [viewing, setViewing] = useState<QueSearchResult | null>(null);

  // Qued or excluded from its full view, a question leaves the results and
  // takes the view with it; a later search hands back new objects, never this one.
  const viewingOpen = viewing !== null && results.includes(viewing);

  useEffect(() => {
    if (!viewingOpen) setViewing(null);
  }, [viewingOpen]);

  return (
    <>
      <ul
        ref={gridRef}
        className={styles.cardGrid}
        style={{ "--grid-cols": columns } as CSSProperties}
      >
        {results.map((result) => (
          <QueCard
            key={result.id}
            result={result}
            selected={selected.has(result.id)}
            expanded={expanded.has(result.id)}
            busy={actingId === result.id}
            blocking={blockingUserId === result.created_by}
            columns={columns}
            actions={actions}
            onView={setViewing}
          />
        ))}
      </ul>

      {viewingOpen && (
        <FullQuestion
          key={viewing.id}
          result={viewing}
          busy={actingId === viewing.id}
          actions={actions}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
