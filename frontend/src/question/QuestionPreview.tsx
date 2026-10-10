import type { ReactNode } from "react";
import { CategoryChips } from "../components/CategoryChip";
import { MarkdownContent } from "../components/MarkdownContent";
import { useFilePreviews } from "./useFilePreviews";
import {
  QUESTION_PART_SPECS,
  type QuestionDraft,
  type QuestionPart,
} from "./question_types";
import sharedStyles from "../styles/shared.module.css";
import styles from "./QuestionPreview.module.css";

interface QuestionPreviewProps {
  draft: QuestionDraft;
  /** When given, the pane gets a Hide button that collapses it. */
  onHide?: () => void;
  /** Sizing class for pages that place the pane in a split layout. */
  className?: string;
}

function PreviewImages({
  draft,
  part,
}: {
  draft: QuestionDraft;
  part: QuestionPart;
}) {
  const previews = useFilePreviews(draft.files?.[part] ?? []);
  const stored = (draft.pics?.[part] ?? []).map((p) => p.pic_string);
  const allImages = [...stored, ...previews];

  if (allImages.length === 0) return null;

  return (
    <div className={styles.previewImages}>
      {allImages.map((src, index) => (
        <img
          key={index}
          src={src}
          alt={`${part} visual ${index + 1}`}
          className={styles.previewImage}
        />
      ))}
    </div>
  );
}

/** The parts that carry a header naming them. The question speaks for itself. */
type HeadedPart = Exclude<QuestionPart, "question">;

const PART_ICONS: Record<HeadedPart, string> = {
  hint: "fa-question-circle",
  answer: "fa-book",
};

/** A header that opens and closes what hangs off it. */
export interface Disclosure {
  open: boolean;
  onToggle: () => void;
  /** Whatever else the page puts on the header, at its far end. */
  extra?: ReactNode;
}

interface PartProps {
  part: HeadedPart;
  /** Makes the header a disclosure; closed, the part is its header alone. */
  disclosure?: Disclosure;
  children: ReactNode;
}

/** A hint or an answer: its name on a header in the part's colour, over the part. */
function Part({ part, disclosure, children }: PartProps) {
  const open = disclosure?.open ?? true;
  const title = (
    <>
      <i className={`fa ${PART_ICONS[part]}`}></i> {QUESTION_PART_SPECS[part].name}
    </>
  );

  return (
    <div className={`${styles.part} ${styles[part]}`}>
      <div className={styles.partHeader}>
        {disclosure ? (
          <button
            type="button"
            className={sharedStyles.disclosureToggle}
            aria-expanded={disclosure.open}
            onClick={disclosure.onToggle}
          >
            {title}
          </button>
        ) : (
          title
        )}
        {disclosure?.extra}
      </div>
      {open && <div className={styles.partBody}>{children}</div>}
    </div>
  );
}

interface QuestionContentProps {
  draft: QuestionDraft;
  /** Hangs the hint and answer off the answer's header, to be opened by it. */
  disclosure?: Disclosure;
}

/**
 * Question, hint and answer, colour-coded the same wherever a question is read
 * rather than answered: in the live preview, in a dialog, on a card.
 */
export function QuestionContent({ draft, disclosure }: QuestionContentProps) {
  const open = disclosure?.open ?? true;
  const hasHint =
    Boolean(draft.text.hint) ||
    (draft.pics?.hint?.length ?? 0) > 0 ||
    (draft.files?.hint?.length ?? 0) > 0;

  return (
    <>
      <div className={`${styles.part} ${styles.question} ${open ? "" : styles.glimpse}`}>
        <div className={styles.partBody}>
          <MarkdownContent content={draft.text.question || "*No question text yet.*"} />
          {open && <PreviewImages draft={draft} part="question" />}
        </div>
      </div>

      {open && hasHint && (
        <Part part="hint">
          {draft.text.hint && <MarkdownContent content={draft.text.hint} />}
          <PreviewImages draft={draft} part="hint" />
        </Part>
      )}

      <Part part="answer" disclosure={disclosure}>
        <MarkdownContent content={draft.text.answer || "*No answer text yet.*"} />
        <PreviewImages draft={draft} part="answer" />
      </Part>
    </>
  );
}

/**
 * The live preview pane around a draft, identical on every page that writes one.
 *
 * The add-content page, the AI question generator and the question editor all
 * render this.
 */
export function QuestionPreview({
  draft,
  onHide,
  className,
}: QuestionPreviewProps) {
  return (
    <div className={`${styles.preview}${className ? ` ${className}` : ""}`}>
      <div className={styles.previewPaneHeader}>
        <h5 className={styles.previewPaneTitle}>
          <i className="fa fa-eye"></i> Live Preview
        </h5>
        {onHide && (
          <button
            type="button"
            className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnQuiet}`}
            onClick={onHide}
            title="Collapse Preview"
          >
            Hide
          </button>
        )}
      </div>

      <div className={styles.previewMetaRow}>
        <strong>Preview View</strong>
        <CategoryChips names={draft.categories} />
      </div>

      <QuestionContent draft={draft} />
    </div>
  );
}
