import { useState, type FormEvent } from "react";
import { Toaster, toast } from "sonner";
import { AskAiLauncher } from "../ask_ai/AskAiLauncher";
import { ExtendButton } from "../question/ExtendButton";
import { QuestionFields } from "../question/QuestionFields";
import { createQuestion } from "../question/question_api";
import {
  draftError,
  emptyDraft,
  type QuestionDraft,
} from "../question/question_types";
import { useFilePreviews } from "../question/useFilePreviews";
import sharedStyles from "../styles/shared.module.css";
import styles from "./AddContent.module.css";

export function AddContentPage() {
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  // The tutor can only be shown a question that has no stored images yet as the
  // pictures themselves.
  const questionImages = useFilePreviews(draft.files.question);
  const answerImages = useFilePreviews(draft.files.answer);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const problem = draftError(draft);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      await createQuestion(draft);
      setDraft(emptyDraft());
      toast.success("New question created.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save the question."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <Toaster richColors position="top-right" />

      <h1 className={styles.pageTitle}>New Question</h1>

      <form onSubmit={handleSubmit}>
        <QuestionFields value={draft} onChange={setDraft} />

        <div className={sharedStyles.actionRow}>
          {/* Nothing is saved yet, so the extended answer comes straight back
              into the draft rather than being kept anywhere. */}
          <ExtendButton target={{}} draft={draft} onExtended={setDraft} />

          <button
            type="submit"
            className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
            disabled={saving}
          >
            {saving ? "Saving..." : "Submit"}
          </button>
        </div>
      </form>

      <AskAiLauncher
        questionId="new"
        questionText={draft.text.question}
        answerText={draft.text.answer}
        answerRevealed={true}
        categories={draft.categories}
        questionImageUrls={questionImages}
        answerImageUrls={answerImages}
      />
    </div>
  );
}
