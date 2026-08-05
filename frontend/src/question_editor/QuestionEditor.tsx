import { useMemo, useState, type FormEvent } from "react";
import { Toaster } from "sonner";
import { Sparkles } from "lucide-react";
import { CatPicker } from "../components/CatPicker";
import { ExtendButton } from "../components/ExtendButton";
import { QuestionEditorAlert } from "./QuestionEditorAlert";
import { QuestionMediaSection } from "./QuestionMediaSection";
import type { QuestionEditorProps } from "./question_editor_types";
import { useQuestionEditor } from "./useQuestionEditor";
import { useAskAi } from "../ask_ai/useAskAi";
import { AskAiPanel } from "../ask_ai/AskAiPanel";
import type { AskAiContext } from "../ask_ai/types";
import { MarkdownContent } from "../components/MarkdownContent";
import styles from "./QuestionEditor.module.css";
import sharedStyles from "../styles/shared.module.css";

const FORM_ID = "question-editor-form";

export function QuestionEditor({
  questionId,
  onDeleted,
  onSaved,
  onClose,
}: QuestionEditorProps) {
  const editor = useQuestionEditor({ questionId, onDeleted, onSaved });
  const [previewOpen, setPreviewOpen] = useState(true);

  const askAiContext = useMemo<AskAiContext | null>(() => {
    if (!questionId) return null;
    return {
      questionId,
      questionText: editor.questionText,
      answerText: editor.answerText,
      categories: editor.selectedCats,
      questionImageUrls: editor.pics.question.map((p) => p.pic_string),
      answerImageUrls: editor.pics.answer.map((p) => p.pic_string),
    };
  }, [
    questionId,
    editor.questionText,
    editor.answerText,
    editor.selectedCats,
    editor.pics.question,
    editor.pics.answer,
  ]);

  const askAi = useAskAi({ context: askAiContext, answerRevealed: true });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void editor.handleSave();
  };

  if (editor.loading) {
    return (
      <div className={sharedStyles.loadingState}>
        <div className={sharedStyles.spinner} role="status">
          <span className={sharedStyles.srOnly}>Loading...</span>
        </div>
        <p className={sharedStyles.loadingText}>Loading question data...</p>
      </div>
    );
  }

  if (!questionId && !editor.loading) {
    return (
      <p className={styles.emptyState}>
        Select a question from the search results to edit it.
      </p>
    );
  }

  return (
    <div className={styles.editorContainer}>
      <Toaster richColors position="top-right" />
      <div className={styles.card}>
      <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTop}>
            <h4>
              <i className={`fa fa-edit ${sharedStyles.iconSpacing}`}></i>Edit Question
            </h4>

            {onClose && (
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
                onClick={onClose}
              >
                Close
              </button>
            )}
          </div>

<div className={sharedStyles.actionRow}>
            <button
              type="button"
              className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
              onClick={() => askAi.actions.start()}
              disabled={!questionId || askAi.isActive}
            >
              <Sparkles size={18} />
              Ask AI Tutor
            </button>

            <ExtendButton
              onExtend={editor.handleExtend}
              disabled={!questionId || editor.extending}
            />

            {!previewOpen && (
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.btnSlate}`}
                onClick={() => setPreviewOpen(true)}
                title="Show Preview"
              >
                <i className="fa fa-eye"></i>
                Show Preview
              </button>
            )}

            <button
              type="button"
              className={`${sharedStyles.actionButton} ${sharedStyles.btnRed}`}
              onClick={editor.handleDelete}
              disabled={editor.deleting || !questionId}
            >
              {editor.deleting ? "Deleting..." : "Delete Question"}
            </button>

            <button
              type="submit"
              form={FORM_ID}
              className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
              disabled={editor.saving}
            >
              {editor.saving ? "Saving..." : "Save Question"}
            </button>
          </div>

        </div>

        <div className={styles.cardBody}>
          {editor.successMsg && (
            <QuestionEditorAlert
              type="success"
              message={editor.successMsg}
              onDismiss={editor.dismissSuccess}
            />
          )}

          {editor.error && (
            <QuestionEditorAlert
              type="error"
              message={editor.error}
              onDismiss={editor.dismissError}
            />
          )}

          <div className={styles.splitLayout}>
            <div className={styles.formPane}>
              <form id={FORM_ID} onSubmit={handleSubmit}>
                <div className={styles.formRow}>
                  <div className={styles.formColumn}>
                    <QuestionMediaSection
                      part="question"
                      fieldLabel="Question Text"
                      mediaLabel="Question"
                      inputId="react-q-file"
                      textareaId="react-q-text"
                      value={editor.questionText}
                      rows={2}
                      maxLength={1500}
                      required
                      sectionClassName={styles.questionSection}
                      textareaClassName={styles.questionTextarea}
                      existingPics={editor.pics.question}
                      files={editor.filesByType.question}
                      onValueChange={editor.setQuestionText}
                      onFileChange={editor.handleFileChange}
                      onRemoveExisting={editor.removeExistingPic}
                      onRemoveNew={editor.removeNewFile}
                    />

                    <QuestionMediaSection
                      part="hint"
                      fieldLabel="Hint"
                      mediaLabel="Hint"
                      inputId="react-hint-file"
                      textareaId="react-hint-text"
                      value={editor.hintText}
                      rows={1}
                      maxLength={2000}
                      sectionClassName={styles.hintSection}
                      textareaClassName={styles.hintTextarea}
                      existingPics={editor.pics.hint}
                      files={editor.filesByType.hint}
                      onValueChange={editor.setHintText}
                      onFileChange={editor.handleFileChange}
                      onRemoveExisting={editor.removeExistingPic}
                      onRemoveNew={editor.removeNewFile}
                    />

                    <QuestionMediaSection
                      part="answer"
                      fieldLabel="The Answer"
                      mediaLabel="Answer"
                      inputId="react-answer-file"
                      textareaId="react-answer-text"
                      value={editor.answerText}
                      rows={2}
                      maxLength={4000}
                      required
                      sectionClassName={styles.answerSection}
                      textareaClassName={styles.answerTextarea}
                      existingPics={editor.pics.answer}
                      files={editor.filesByType.answer}
                      onValueChange={editor.setAnswerText}
                      onFileChange={editor.handleFileChange}
                      onRemoveExisting={editor.removeExistingPic}
                      onRemoveNew={editor.removeNewFile}
                    />

                    <div className={styles.audioCard}>
                      <div className={styles.audioHeader}>
                        <i
                          className={`fa fa-volume-up ${sharedStyles.iconSpacing}`}
                        ></i>
                        Audio Assets
                      </div>
                      <div className={styles.audioBody}>
                        {editor.audioFiles.length === 0 ? (
                          <p className={styles.emptyAudioText}>
                            No audio assets generated for this question yet.
                          </p>
                        ) : (
                          <div className={sharedStyles.tableResponsive}>
                            <table className={styles.audioTable}>
                              <thead>
                                <tr>
                                  <th>Part</th>
                                  <th>Language</th>
                                  <th>Text Snippet</th>
                                  <th>Audio</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {editor.audioFiles.map((audio) => (
                                  <tr key={audio.audio_id}>
                                    <td
                                      className={`${sharedStyles.tableCell} ${sharedStyles.capitalize}`}
                                    >
                                      <span className={styles.badge}>
                                        {audio.part}
                                      </span>
                                    </td>
                                    <td
                                      className={`${sharedStyles.tableCell} ${sharedStyles.uppercase}`}
                                    >
                                      <code>{audio.language}</code>
                                    </td>
                                    <td
                                      className={`${sharedStyles.tableCell} ${sharedStyles.smallCell} ${styles.snippetCell}`}
                                    >
                                      {audio.audio_text || "N/A"}
                                    </td>
                                    <td
                                      className={`${sharedStyles.tableCell} ${sharedStyles.centerCell}`}
                                    >
                                      {audio.public_url ? (
                                        <audio
                                          src={audio.public_url}
                                          controls
                                          className={styles.audioPlayer}
                                        />
                                      ) : (
                                        <span className={sharedStyles.mutedText}>
                                          No URL
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      className={`${sharedStyles.tableCell} ${sharedStyles.centerCell}`}
                                    >
                                      <button
                                        type="button"
                                        className={styles.audioDeleteBtn}
                                        onClick={() =>
                                          editor.handleAudioDelete(audio.audio_id)
                                        }
                                        title="Delete Audio"
                                      >
                                        <i className="fa fa-trash"></i> Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    <CatPicker
                      selectedCategories={editor.selectedCats}
                      onChange={editor.setSelectedCats}
                    />

                    <div className={styles.privacyGroup}>
                      <input
                        type="checkbox"
                        className={styles.privacyCheckbox}
                        id="react-privacy"
                        checked={editor.privacy}
                        onChange={(event) =>
                          editor.setPrivacy(event.target.checked)
                        }
                      />
                      <label
                        className={styles.privacyLabel}
                        htmlFor="react-privacy"
                      >
                        Make Question Private
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {previewOpen && (
              <div className={styles.previewPane}>
                <div className={styles.previewPaneHeader}>
                  <h5 className={styles.previewPaneTitle}>
                    <i className="fa fa-eye"></i> Live Preview
                  </h5>
                  <button
                    type="button"
                    className={styles.previewCloseBtn}
                    onClick={() => setPreviewOpen(false)}
                    title="Collapse Preview"
                  >
                    Hide
                  </button>
                </div>

                <div className={styles.previewMetaRow}>
                  <strong>Preview View</strong>
                  {editor.selectedCats.map((cat) => (
                    <span key={cat} className={styles.badge}>{cat}</span>
                  ))}
                </div>

                <div className={styles.previewTextBlock}>
                  <MarkdownContent content={editor.questionText || "*No question text yet.*"} />
                </div>

                {editor.hintText && (
                  <div className={styles.previewHintCard}>
                    <div className={styles.previewHintHeader}>
                      <i className="fa fa-question-circle"></i> Hint
                    </div>
                    <div className={styles.previewHintContent}>
                      <MarkdownContent content={editor.hintText} />
                    </div>
                  </div>
                )}

                <div className={styles.previewAnswerCard}>
                  <div className={styles.previewAnswerHeader}>
                    <i className="fa fa-book"></i> The Answer
                  </div>
                  <div className={styles.previewAnswerContent}>
                    <MarkdownContent content={editor.answerText || "*No answer text yet.*"} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div id="ask-ai-conversation-root" className={styles.askAiRoot}>
            <AskAiPanel state={askAi} />
          </div>
        </div>
      </div>
    </div>
  );
}
