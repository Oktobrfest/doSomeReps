import { Sparkles } from "lucide-react";
import { ExtendButton } from "./ExtendButton";
import type { ExtendTarget } from "./question_api";
import type { QuestionDraft } from "./question_types";
import sharedStyles from "../styles/shared.module.css";

interface QuestionDraftActionsProps {
  draft: QuestionDraft;
  /** Where an extended answer is kept; see `ExtendTarget`. */
  extendTarget: ExtendTarget;
  onExtended: (next: QuestionDraft) => void;
  onAskAi?: () => void;
  askAiDisabled?: boolean;
  saveLabel?: string;
  /** Save click handler. Omit it inside a `<form>`: the button submits it. */
  onSave?: () => void;
  saving?: boolean;
  /** Rendered only when given. */
  onDelete?: () => void;
  deleting?: boolean;
  deleteLabel?: string;
  /** A Show/Hide Preview toggle. */
  previewOpen?: boolean;
  onTogglePreview?: () => void;
  /** Disables every control while a batch operation runs. */
  busy?: boolean;
}

/**
 * The one row of buttons every question draft page pairs its fields with:
 * Ask AI, AI extend, preview toggle, delete, save. The add-content
 * page, the AI question generator and the question editor all render this, so
 * the three cannot offer different actions for the same work.
 */
export function QuestionDraftActions({
  draft,
  extendTarget,
  onExtended,
  onAskAi,
  askAiDisabled = false,
  saveLabel = "Save Question",
  onSave,
  saving = false,
  onDelete,
  deleting = false,
  deleteLabel = "Delete Question",
  previewOpen,
  onTogglePreview,
  busy = false,
}: QuestionDraftActionsProps) {
  return (
    <div className={sharedStyles.actionRow}>
      {onAskAi && (
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
          onClick={onAskAi}
          disabled={busy || askAiDisabled}
        >
          <Sparkles size={18} />
          Ask AI
        </button>
      )}

      <ExtendButton
        target={extendTarget}
        draft={draft}
        onExtended={onExtended}
        disabled={busy}
      />

      {onTogglePreview && (
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnSlate}`}
          onClick={onTogglePreview}
          title={previewOpen ? "Hide Preview" : "Show Preview"}
        >
          <i className={previewOpen ? "fa fa-eye-slash" : "fa fa-eye"}></i>{" "}
          {previewOpen ? "Hide Preview" : "Show Preview"}
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnRed}`}
          onClick={onDelete}
          disabled={busy || deleting}
        >
          {deleting ? "Deleting..." : deleteLabel}
        </button>
      )}

      <button
        type={onSave ? "button" : "submit"}
        className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
        onClick={onSave}
        disabled={busy || saving}
      >
        {saving ? "Saving..." : saveLabel}
      </button>
    </div>
  );
}
