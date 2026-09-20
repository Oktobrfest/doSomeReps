import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { LoadingState } from "../components/LoadingState";
import { MarkdownContent } from "../components/MarkdownContent";
import { ExtendButton } from "../question/ExtendButton";
import { QuestionFields } from "../question/QuestionFields";
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

          <div className={sharedStyles.actionRow}>
            <button
              type="button"
              className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
              onClick={() => askAi.actions.start()}
              disabled={askAi.isActive}
            >
              <Sparkles size={18} />
              Ask AI Tutor
            </button>

            {/* An extend belongs to the question it was started from: moving
                to another question drops the request rather than applying it. */}
            <ExtendButton
              key={questionId}
              target={{ questionId }}
              draft={draft}
              onExtended={editor.setDraft}
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
              disabled={editor.deleting}
            >
              {editor.deleting ? "Deleting..." : "Delete Question"}
            </button>

            <button
              type="button"
              className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
              onClick={editor.handleSave}
              disabled={editor.saving}
            >
              {editor.saving ? "Saving..." : "Save Question"}
            </button>
          </div>
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
                                <span className={styles.badge}>{audio.part}</span>
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
              <div className={styles.previewPane}>
                <div className={styles.previewPaneHeader}>
                  <h5 className={styles.previewPaneTitle}>
                    <i className="fa fa-eye"></i> Live Preview
                  </h5>
                  <button
                    type="button"
                    className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnQuiet}`}
                    onClick={() => setPreviewOpen(false)}
                    title="Collapse Preview"
                  >
                    Hide
                  </button>
                </div>

                <div className={styles.previewMetaRow}>
                  <strong>Preview View</strong>
                  {draft.categories.map((cat) => (
                    <span key={cat} className={styles.badge}>
                      {cat}
                    </span>
                  ))}
                </div>

                <div className={styles.previewTextBlock}>
                  <MarkdownContent
                    content={draft.text.question || "*No question text yet.*"}
                  />
                </div>

                {draft.text.hint && (
                  <div className={styles.previewHintCard}>
                    <div className={styles.previewHintHeader}>
                      <i className="fa fa-question-circle"></i> Hint
                    </div>
                    <div className={styles.previewHintContent}>
                      <MarkdownContent content={draft.text.hint} />
                    </div>
                  </div>
                )}

                <div className={styles.previewAnswerCard}>
                  <div className={styles.previewAnswerHeader}>
                    <i className="fa fa-book"></i> The Answer
                  </div>
                  <div className={styles.previewAnswerContent}>
                    <MarkdownContent
                      content={draft.text.answer || "*No answer text yet.*"}
                    />
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
