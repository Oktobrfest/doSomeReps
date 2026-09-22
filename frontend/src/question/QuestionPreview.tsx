import { CategoryChips } from "../components/CategoryChip";
import { MarkdownContent } from "../components/MarkdownContent";
import { useFilePreviews } from "./useFilePreviews";
import type { QuestionDraft, QuestionPart } from "./question_types";
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

/**
 * The live read view of a draft, identical on every page that writes one.
 *
 * The add-content page, the AI question generator and the question editor all
 * render this: question, hint and answer exactly as the quiz will show them.
 */
export function QuestionPreview({
  draft,
  onHide,
  className,
}: QuestionPreviewProps) {
  const hasHint =
    Boolean(draft.text.hint) ||
    (draft.pics?.hint?.length ?? 0) > 0 ||
    (draft.files?.hint?.length ?? 0) > 0;

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

      <div className={styles.previewTextBlock}>
        <MarkdownContent
          content={draft.text.question || "*No question text yet.*"}
        />
        <PreviewImages draft={draft} part="question" />
      </div>

      {hasHint && (
        <div className={styles.previewHintCard}>
          <div className={styles.previewHintHeader}>
            <i className="fa fa-question-circle"></i> Hint
          </div>
          <div className={styles.previewHintContent}>
            {draft.text.hint && <MarkdownContent content={draft.text.hint} />}
            <PreviewImages draft={draft} part="hint" />
          </div>
        </div>
      )}

      <div className={styles.previewAnswerCard}>
        <div className={styles.previewAnswerHeader}>
          <i className="fa fa-book"></i> The Answer
        </div>
        <div className={styles.previewAnswerContent}>
          <MarkdownContent
            content={draft.text.answer || "*No answer text yet.*"}
          />
          <PreviewImages draft={draft} part="answer" />
        </div>
      </div>
    </div>
  );
}
