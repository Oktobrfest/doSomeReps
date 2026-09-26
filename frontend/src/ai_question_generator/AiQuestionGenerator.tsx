import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import "../lib/toast";

import { AskAiPanel } from "../ask_ai/AskAiPanel";
import { useAskAi } from "../ask_ai/useAskAi";
import type { AskAiContext } from "../ask_ai/types";
import { CategoryPicker } from "../components/CategoryPicker";
import { LoadingState } from "../components/LoadingState";
import { QuestionDraftActions } from "../question/QuestionDraftActions";
import { QuestionFields } from "../question/QuestionFields";
import { QuestionPreview } from "../question/QuestionPreview";
import { createQuestion, extendQuestion } from "../question/question_api";
import { emptyDraft, type QuestionDraft } from "../question/question_types";
import {
  clearGenerated,
  generateQuestions,
  getGeneratorState,
  removeGenerated,
} from "./ai_question_generator_api";
import styles from "./AiQuestionGenerator.module.css";
import sharedStyles from "../styles/shared.module.css";

const MAX_QUESTIONS = 50;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

interface GeneratedCardProps {
  index: number;
  draft: QuestionDraft;
  busy: boolean;
  onChange: (next: QuestionDraft) => void;
  onSave: () => void;
  onDelete: () => void;
}

/** One generated question, editable with the same fields as any other. */
function GeneratedCard({
  index,
  draft,
  busy,
  onChange,
  onSave,
  onDelete,
}: GeneratedCardProps) {
  const [previewOpen, setPreviewOpen] = useState(true);

  const askAiContext = useMemo<AskAiContext>(
    () => ({
      questionId: `gen-${index}`,
      questionText: draft.text.question,
      answerText: draft.text.answer,
      categories: draft.categories,
      questionImageUrls: draft.pics.question.map((p) => p.pic_string),
      answerImageUrls: draft.pics.answer.map((p) => p.pic_string),
    }),
    [index, draft]
  );

  const askAi = useAskAi({ context: askAiContext, answerRevealed: true });

  return (
    <section className={styles.questionGroup}>
      <div className={styles.cardHeader}>
        <h3 className={styles.questionGroupHeader}>Question #{index + 1}</h3>

        {/* The extended answer is kept in the working list, not the database. */}
        <QuestionDraftActions
          draft={draft}
          extendTarget={draft.isLocal ? {} : { index }}
          onExtended={onChange}
          onAskAi={() => askAi.actions.start()}
          askAiDisabled={askAi.isActive}
          saveLabel="Save Question"
          onSave={onSave}
          onDelete={onDelete}
          deleteLabel="Delete Question"
          busy={busy}
          previewOpen={previewOpen}
          onTogglePreview={() => setPreviewOpen((prev) => !prev)}
        />
      </div>

      <div className={sharedStyles.splitLayout}>
        <div className={sharedStyles.formPane}>
          <QuestionFields value={draft} onChange={onChange} />
        </div>

        {previewOpen && (
          <QuestionPreview
            draft={draft}
            onHide={() => setPreviewOpen(false)}
            className={sharedStyles.previewPane}
          />
        )}
      </div>

      <div className={styles.askAiRoot}>
        <AskAiPanel state={askAi} />
      </div>
    </section>
  );
}

export function AiQuestionGenerator() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);

  const [quizContent, setQuizContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [qtyFrom, setQtyFrom] = useState(5);
  const [qtyTo, setQtyTo] = useState(10);
  const [tryProvideHints, setTryProvideHints] = useState(false);
  const [avoidDuplicates, setAvoidDuplicates] = useState(false);
  // The browser owns a file input's value; clearing state alone leaves the
  // filename on screen.
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGeneratorState()
      .then((state) => {
        setDrafts(state.drafts);
        setCategories(state.categories);
      })
      .catch((err) => toast.error(errorMessage(err, "Error loading state")))
      .finally(() => setLoading(false));
  }, []);

  const replaceAt = (index: number, next: QuestionDraft) =>
    setDrafts((prev) => prev.map((draft, at) => (at === index ? next : draft)));

  const dropAt = (index: number) =>
    setDrafts((prev) => prev.filter((_, at) => at !== index));

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();

    if (!quizContent.trim() && !file) {
      toast.error("Quiz content or a document file is required.");
      return;
    }
    if (categories.length === 0) {
      toast.error(
        "Pick at least one category - the AI tags every generated question with them."
      );
      return;
    }

    setBusy(true);
    try {
      const generated = await generateQuestions({
        quizContent,
        file,
        categories,
        qtyFrom,
        qtyTo,
        tryProvideHints,
        avoidDuplicates,
      });
      setDrafts(generated);
      setQuizContent("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`Generated ${generated.length} question(s).`);
    } catch (err) {
      toast.error(errorMessage(err, "Generation failed"));
    } finally {
      setBusy(false);
    }
  };

  /** Write one generated question, then drop it from the working list. */
  const saveOne = async (index: number) => {
    await createQuestion(drafts[index]);
    if (!drafts[index].isLocal) {
      await removeGenerated(index);
    }
    dropAt(index);
  };

  const handleSaveOne = async (index: number) => {
    setBusy(true);
    try {
      await saveOne(index);
      toast.success("Question saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOne = async (index: number) => {
    setBusy(true);
    try {
      if (!drafts[index].isLocal) {
        await removeGenerated(index);
      }
      dropAt(index);
    } catch (err) {
      toast.error(errorMessage(err, "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  /** Back to front, so removing one never shifts an index still to come. */
  const handleSaveAll = async () => {
    setBusy(true);
    let saved = 0;
    const failures: string[] = [];

    for (let index = drafts.length - 1; index >= 0; index--) {
      try {
        await saveOne(index);
        saved += 1;
      } catch (err) {
        failures.push(`#${index + 1}: ${errorMessage(err, "Save failed")}`);
      }
    }

    setBusy(false);
    if (saved > 0) toast.success(`Saved ${saved} question(s).`);
    if (failures.length > 0) toast.error(failures.join("; "));
  };

  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        "Delete all generated questions? This will not remove anything from the database."
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await clearGenerated();
      setDrafts([]);
    } catch (err) {
      toast.error(errorMessage(err, "Delete all failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleExtendAll = async () => {
    setBusy(true);
    const controller = new AbortController();
    let extended = 0;
    const failures: string[] = [];

    for (const [index, draft] of drafts.entries()) {
      try {
        const { text, messageToEditor } = await extendQuestion(
          draft.isLocal ? {} : { index },
          draft,
          "",
          [],
          controller.signal
        );
        replaceAt(index, { ...draft, text });
        if (messageToEditor) toast.info(`#${index + 1}: ${messageToEditor}`);
        extended += 1;
      } catch (err) {
        failures.push(`#${index + 1}: ${errorMessage(err, "Extend failed")}`);
      }
    }

    setBusy(false);
    if (extended > 0) toast.success(`Extended ${extended} answer(s).`);
    if (failures.length > 0) toast.error(failures.join("; "));
  };

  const applyToAll = (patch: Partial<QuestionDraft>) =>
    setDrafts((prev) => prev.map((draft) => ({ ...draft, ...patch })));

  if (loading) {
    return <LoadingState message="Loading AI Question Generator..." />;
  }

  const allQueued = drafts.length > 0 && drafts.every((d) => d.autoQue);
  const allPrivate = drafts.length > 0 && drafts.every((d) => d.privacy);

  return (
    <div className={styles.container}>
      <Toaster richColors position="top-right" />

      <h1 className={styles.title}>AI Question Generator</h1>
      <p className={styles.description}>
        Have AI generate quiz questions from your material.
      </p>

      <form onSubmit={handleGenerate} className={styles.card}>
        <p className={styles.subLabel}>
          <strong>Categories are required.</strong> The AI tags every generated
          question with the ones you pick.
        </p>

        <div className={styles.formGroup}>
          {/* The master set: every generated question is tagged from it, so it is
              the one categories section on this page that opens by default. */}
          <CategoryPicker
            selectedCategories={categories}
            onChange={setCategories}
            allowCreate
            defaultExpanded
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="file_upload" className={styles.label}>
            Upload Document (Optional)
          </label>
          <span className={styles.subLabel}>
            A PDF or an image (PNG, JPG, JPEG) to generate questions from.
          </span>
          <input
            id="file_upload"
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className={styles.input}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="quiz_content" className={styles.label}>
            Quiz Content {file ? "(Optional)" : ""}
          </label>
          <span className={styles.subLabel}>
            The material you would like questions generated from.
          </span>
          <textarea
            id="quiz_content"
            className={styles.textarea}
            rows={10}
            placeholder={
              file
                ? "Optional when a document is uploaded..."
                : "Paste or type the source material..."
            }
            value={quizContent}
            onChange={(e) => setQuizContent(e.target.value)}
            required={!file}
          />
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Qty. of Questions to create</legend>
          <p className={styles.subLabel}>
            Generate <strong>between this many questions</strong>. Each value
            must be 0&ndash;{MAX_QUESTIONS}.
          </p>
          <div className={styles.row}>
            <div className={styles.col}>
              <label htmlFor="qty_from" className={styles.label}>
                From
              </label>
              <input
                id="qty_from"
                type="number"
                className={styles.input}
                min={0}
                max={MAX_QUESTIONS}
                value={qtyFrom}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  setQtyFrom(value);
                  if (qtyTo < value + 1) setQtyTo(value + 1);
                }}
              />
              <span className={styles.subLabel}>at least this many</span>
            </div>
            <div className={styles.col}>
              <label htmlFor="qty_to" className={styles.label}>
                To
              </label>
              <input
                id="qty_to"
                type="number"
                className={styles.input}
                min={Math.max(1, qtyFrom + 1)}
                max={MAX_QUESTIONS}
                value={qtyTo}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10) || 0;
                  setQtyTo(Math.max(value, Math.max(1, qtyFrom + 1)));
                }}
              />
              <span className={styles.subLabel}>up to this many</span>
            </div>
          </div>
        </fieldset>

        <label className={styles.checkboxContainer}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={tryProvideHints}
            onChange={(e) => setTryProvideHints(e.target.checked)}
          />
          <span>
            <span className={styles.checkboxLabel}>Try to use hints</span>
            <span className={styles.subLabel}>
              A separate AI call generates hints for the questions it considers
              difficult enough to warrant one.
            </span>
          </span>
        </label>

        <label className={styles.checkboxContainer}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={avoidDuplicates}
            onChange={(e) => setAvoidDuplicates(e.target.checked)}
          />
          <span>
            <span className={styles.checkboxLabel}>Avoid duplicates</span>
            <span className={styles.subLabel}>
              Existing questions under these categories are passed to the AI so
              it does not generate them again.
            </span>
          </span>
        </label>

        <button
          type="submit"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
          disabled={busy}
        >
          {busy && (
            <Loader2
              className={`${sharedStyles.buttonIcon} ${sharedStyles.spinIcon}`}
            />
          )}
          {busy ? "Working..." : "Get AI Questions!"}
        </button>
      </form>

      <hr className={styles.divider} />

      <section id="ai-generated-questions">
        <h2 className={styles.sectionTitle}>Generated Questions</h2>

        <div className={sharedStyles.actionCluster}>
          <button
            type="button"
            className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnTeal}`}
            onClick={() =>
              setDrafts((prev) => [
                ...prev,
                { ...emptyDraft(), categories, isLocal: true },
              ])
            }
            disabled={busy}
          >
            Add Question
          </button>
          {drafts.length > 0 && (
            <>
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnGreen}`}
                onClick={handleSaveAll}
                disabled={busy}
              >
                Save All
              </button>
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnRed}`}
                onClick={handleDeleteAll}
                disabled={busy}
              >
                Delete All
              </button>
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnTeal}`}
                onClick={handleExtendAll}
                disabled={busy}
              >
                Extend All
              </button>
            </>
          )}
        </div>

        {drafts.length === 0 ? (
          <p className={styles.subLabel}>
            Generated questions will appear here once you click "Get AI
            Questions!" above, or you can add one manually.
          </p>
        ) : (
          <>
            <div className={styles.masterToggles}>
              <span className={styles.masterTogglesTitle}>Apply to all:</span>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allQueued}
                  onChange={(e) => applyToAll({ autoQue: e.target.checked })}
                />
                <span className={styles.checkboxLabel}>Add all to Que</span>
              </label>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allPrivate}
                  onChange={(e) => applyToAll({ privacy: e.target.checked })}
                />
                <span className={styles.checkboxLabel}>Mark all Private</span>
              </label>
            </div>

            {drafts.map((draft, index) => (
              <GeneratedCard
                key={index}
                index={index}
                draft={draft}
                busy={busy}
                onChange={(next) => replaceAt(index, next)}
                onSave={() => void handleSaveOne(index)}
                onDelete={() => void handleDeleteOne(index)}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
