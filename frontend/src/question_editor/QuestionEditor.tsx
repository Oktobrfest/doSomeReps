import { useMemo, useState } from "react";
import { LoadingState } from "../components/LoadingState";
import { QuestionDraftActions } from "../question/QuestionDraftActions";
import { QuestionFields } from "../question/QuestionFields";
import { QuestionPreview } from "../question/QuestionPreview";
import { AskAiPanel } from "../ask_ai/AskAiPanel";
import { useAskAi } from "../ask_ai/useAskAi";
import type { AskAiContext } from "../ask_ai/types";
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
  const [previewOpen, setPreviewOpen] = useState(true);
  const { draft } = editor;

  const askAiContext = useMemo<AskAiContext | null>(
    () =>
      questionId
        ? {
            questionId,
            questionText: draft.text.question,
            answerText: draft.text.answer,
            categories: draft.categories,
            questionImageUrls: draft.pics.question.map((p) => p.pic_string),
            answerImageUrls: draft.pics.answer.map((p) => p.pic_string),
          }
        : null,
    [questionId, draft]
  );

  const askAi = useAskAi({ context: askAiContext, answerRevealed: true });

  if (editor.loading) {
    return <LoadingState message="Loading question data..." />;
  }

  if (!questionId) {
    return (
      <p className={styles.emptyState}>
        Select a question from the search results to edit it.
      </p>
    );
  }

  return (
    <div className={styles.editorContainer}>
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

          {/* An extend belongs to the question it was started from: moving
              to another question drops the request rather than applying it. */}
          <QuestionDraftActions
            key={questionId}
            draft={draft}
            extendTarget={{ questionId }}
            onExtended={editor.setDraft}
            onAskAi={() => askAi.actions.start()}
            askAiDisabled={askAi.isActive}
            saveLabel="Save Question"
            onSave={editor.handleSave}
            saving={editor.saving}
            onDelete={editor.handleDelete}
            deleting={editor.deleting}
            deleteLabel="Delete Question"
            previewOpen={previewOpen}
            onTogglePreview={() => setPreviewOpen((prev) => !prev)}
          />
        </div>

        <div className={styles.cardBody}>
          <div className={styles.splitLayout}>
            <div className={styles.formPane}>
              <QuestionFields
                value={draft}
                onChange={editor.setDraft}
                showAutoQue={false}
              />

              <div className={styles.audioCard}>
                <div className={styles.audioHeader}>
                  <i className={`fa fa-volume-up ${sharedStyles.iconSpacing}`}></i>
                  Audio Assets
                </div>
                <div className={styles.audioBody}>
                  {editor.audio.length === 0 ? (
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
                          {editor.audio.map((audio) => (
                            <tr key={audio.audio_id}>
                              <td
                                className={`${sharedStyles.tableCell} ${sharedStyles.capitalize}`}
                              >
                                <span className={sharedStyles.badge}>{audio.part}</span>
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
                                  className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnRed}`}
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
            </div>

            {previewOpen && (
              <QuestionPreview
                draft={draft}
                onHide={() => setPreviewOpen(false)}
                className={styles.previewPane}
              />
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
