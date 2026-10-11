import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { errorMessage } from "../lib/errors";
import { notify } from "../toast/notify";
import styles from "./AddContent.module.css";
import sharedStyles from "../styles/shared.module.css";

/** Questions written here tend to come in runs under the same categories. */
const CATEGORIES_KEY = "addcontent.categories";

function storedCategories(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CATEGORIES_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    // Unreadable storage only costs the page its remembered categories.
    return [];
  }
}

export function AddContentPage() {
  const [draft, setDraft] = useState<QuestionDraft>(() => ({ ...emptyDraft(), categories: storedCategories() }));
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

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(draft.categories));
    } catch {
      // Unwritable storage only costs the next visit its starting categories.
    }
  }, [draft.categories]);

  const handleSave = async () => {
    const problem = draftError(draft);
    if (problem) {
      notify.error(problem);
      return;
    }

    setSaving(true);
    try {
      await createQuestion(draft);
      setDraft({ ...emptyDraft(), categories: draft.categories });
      notify.success("New question created.");
    } catch (err) {
      notify.error(errorMessage(err, "Could not save the question."));
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
