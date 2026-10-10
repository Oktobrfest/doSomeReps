import { QuestionPart as ReadingPart } from "./QuestionReading";
import { CategoryChips } from "../components/CategoryChip";
import { MarkdownContent } from "../components/MarkdownContent";
import { useFilePreviews } from "./useFilePreviews";
import {
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

/** A draft part's markdown and stored or newly picked images. */
export function QuestionPreviewBody({ draft, part }: { draft: QuestionDraft; part: QuestionPart }) {
  const text = draft.text[part] || (part === "hint" ? "" : `*No ${part} text yet.*`);
  return <>
    {text && <MarkdownContent content={text} />}
    <PreviewImages draft={draft} part={part} />
  </>;
}

function QuestionContent({ draft }: { draft: QuestionDraft }) {
  const hasHint = Boolean(draft.text.hint) || draft.pics.hint.length > 0 || draft.files.hint.length > 0;
  return (
    <>
      <div className={styles.question}>
        <div className={styles.partBody}><QuestionPreviewBody draft={draft} part="question" /></div>
      </div>
      {hasHint && <ReadingPart part="hint"><QuestionPreviewBody draft={draft} part="hint" /></ReadingPart>}
      <ReadingPart part="answer"><QuestionPreviewBody draft={draft} part="answer" /></ReadingPart>
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
