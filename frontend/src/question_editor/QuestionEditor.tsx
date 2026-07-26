import type { FormEvent } from "react";
import { Toaster } from "sonner";
import { CatPicker } from "../components/CatPicker";
import { ExtendButton } from "../components/ExtendButton";
import { QuestionEditorAlert } from "./QuestionEditorAlert";
import { QuestionMediaSection } from "./QuestionMediaSection";
import type { QuestionEditorProps } from "./question_editor_types";
import { useQuestionEditor } from "./useQuestionEditor";
import styles from "./QuestionEditor.module.css";
import sharedStyles from "../styles/shared.module.css";

export function QuestionEditor({
  questionId,
  onDeleted,
  onSaved,
  onClose,
}: QuestionEditorProps) {
  const editor = useQuestionEditor({ questionId, onDeleted, onSaved });

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
          <h4>
            <i className={`fa fa-edit ${sharedStyles.iconSpacing}`}></i>Edit Question
          </h4>
          {onClose && (
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
            >
              Close
            </button>
          )}
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

          <form onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <QuestionMediaSection
                  part="question"
                  fieldLabel="Question Text"
                  mediaLabel="Question"
                  inputId="react-q-file"
                  textareaId="react-q-text"
                  value={editor.questionText}
                  rows={6}
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
                  rows={3}
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
                  rows={8}
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

            <div className={styles.buttonFooter}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.redBtn}`}
                onClick={editor.handleDelete}
                disabled={editor.deleting || !questionId}
              >
                {editor.deleting ? "Deleting..." : "Delete Question"}
              </button>
              <div className={styles.rightButtons}>
                <ExtendButton
                  onExtend={editor.handleExtend}
                  disabled={!questionId || editor.extending}
                />
                <button
                  type="submit"
                  className={`${styles.actionBtn} ${styles.blueBtn}`}
                  disabled={editor.saving}
                >
                  {editor.saving ? "Saving..." : "Save Question"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
