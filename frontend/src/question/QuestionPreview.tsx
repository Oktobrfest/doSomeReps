import { useState } from "react";
import { QuestionView } from "./QuestionReading";
import { ImageModal } from "../quiz/ImageModal";
import { CategoryChips } from "../components/CategoryChip";
import type { QuestionDraft } from "./question_types";
import sharedStyles from "../styles/shared.module.css";
import styles from "./QuestionPreview.module.css";

interface QuestionPreviewProps {
  draft: QuestionDraft;
  /** When given, the pane gets a Hide button that collapses it. */
  onHide?: () => void;
  /** Sizing class for pages that place the pane in a split layout. */
  className?: string;
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
  const [imageView, setImageView] = useState<{ images: string[]; startIndex: number } | null>(null);
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

      <QuestionView draft={draft} onOpen={(images, startIndex) => setImageView({ images, startIndex })} />
      {imageView && <ImageModal {...imageView} onClose={() => setImageView(null)} />}
    </div>
  );
}
