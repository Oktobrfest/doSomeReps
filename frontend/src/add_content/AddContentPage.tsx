import { useMemo, useState, type FormEvent } from "react";
import { Toaster, toast } from "sonner";
import { AskAiPanel } from "../ask_ai/AskAiPanel";
import { useAskAi } from "../ask_ai/useAskAi";
import type { AskAiContext } from "../ask_ai/types";
import { QuestionDraftActions } from "../question/QuestionDraftActions";
import { QuestionFields } from "../question/QuestionFields";
import { QuestionPreview } from "../question/QuestionPreview";
import { createQuestion } from "../question/question_api";
import {
  draftError,
  emptyDraft,
  type QuestionDraft,
} from "../question/question_types";
import { useFilePreviews } from "../question/useFilePreviews";
import styles from "./AddContent.module.css";
import sharedStyles from "../styles/shared.module.css";

export function AddContentPage() {
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);

  const questionImages = useFilePreviews(draft.files.question);
  const answerImages = useFilePreviews(draft.files.answer);

  const askAiContext = useMemo<AskAiContext>(
    () => ({
      questionId: "new",
      questionText: draft.text.question,
      answerText: draft.text.answer,
      categories: draft.categories,
      questionImageUrls: questionImages,
      answerImageUrls: answerImages,
    }),
    [draft.text.question, draft.text.answer, draft.categories, questionImages, answerImages]
  );

  const askAi = useAskAi({ context: askAiContext, answerRevealed: true });

  const handleSave = async () => {
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSave();
  };

  return (
    <div className={styles.page}>
      <Toaster richColors position="top-right" />

      <form onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>New Question</h1>

          {/* Nothing is saved yet, so the extended answer comes straight back
              into the draft rather than being kept anywhere. */}
          <QuestionDraftActions
            draft={draft}
            extendTarget={{}}
            onExtended={setDraft}
            onAskAi={() => askAi.actions.start()}
            askAiDisabled={askAi.isActive}
            saveLabel="Save Question"
            saving={saving}
            previewOpen={previewOpen}
            onTogglePreview={() => setPreviewOpen((prev) => !prev)}
          />
        </div>

        <div className={sharedStyles.splitLayout}>
          <div className={sharedStyles.formPane}>
            <QuestionFields value={draft} onChange={setDraft} categoriesExpanded />
          </div>

          {previewOpen && (
            <QuestionPreview
              draft={draft}
              onHide={() => setPreviewOpen(false)}
              className={sharedStyles.previewPane}
            />
          )}
        </div>
      </form>

      <div id="ask-ai-conversation-root" className={styles.askAiRoot}>
        <AskAiPanel state={askAi} />
      </div>
    </div>
  );
}
