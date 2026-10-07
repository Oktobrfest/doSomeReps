import { useId, useState } from 'react';
import { MarkdownContent } from '../components/MarkdownContent';
import { AutoResizeTextarea } from '../components/AutoResizeTextarea';
import { cx, LargePlayableControl } from '../quiz/AudioControls';
import { X, Mic } from 'lucide-react';
import sharedStyles from '../styles/shared.module.css';
import styles from './AskAiPanel.module.css';
import type { AskAiState } from './types';

interface AskAiPanelProps {
  state: AskAiState;
  bottomPadding?: number;
}

interface TypedQuestionFormProps {
  onSend: (question: string) => void;
  onCancel: () => void;
}

/** Owns only the draft text; the hook owns the session it is sent into. */
function TypedQuestionForm({ onSend, onCancel }: TypedQuestionFormProps) {
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const question = draft.trim();

  return (
    <form
      className={styles.askAiContainer}
      onSubmit={(event) => {
        event.preventDefault();
        if (question) onSend(question);
      }}
    >
      <label className={styles.askAiTitle} htmlFor={inputId}>
        Type your question
      </label>
      <AutoResizeTextarea
        id={inputId}
        className={styles.askAiQuestionInput}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        autoFocus
      />
      <div className={styles.askAiActions}>
        <button
          type="submit"
          className={cx(
            sharedStyles.actionButton,
            sharedStyles.buttonTouchMd,
            sharedStyles.buttonWrap,
            sharedStyles.btnBlue,
          )}
          disabled={!question}
        >
          Send
        </button>
        <button
          type="button"
          className={cx(
            sharedStyles.actionButton,
            sharedStyles.buttonTouchMd,
            sharedStyles.buttonWrap,
            sharedStyles.btnSlate,
          )}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AskAiPanel({ state, bottomPadding }: AskAiPanelProps) {
  const {
    isActive,
    isRecording,
    isTyping,
    phase,
    transcript,
    error,
    history,
    availableImageCount,
    includeImages,
    actions,
  } = state;

  if (!isActive) return null;

  const showFollowUp = !isRecording && !isTyping && !phase;
  const showCancelSession = history.length > 0 || showFollowUp;
  const showSessionActions = showFollowUp || showCancelSession;

  return (
    <div
      className={styles.askAiPanel}
      style={bottomPadding ? { paddingBottom: `${bottomPadding}px` } : undefined}
    >
      {availableImageCount > 0 && (
        <label className={styles.askAiImageToggle}>
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => actions.setIncludeImages(e.target.checked)}
            disabled={!!phase}
          />
          <span>
            Send {availableImageCount} image{availableImageCount === 1 ? '' : 's'} to the AI
          </span>
        </label>
      )}

      {history.map((turn, index) => (
        <div key={turn.id} className={styles.askAiTurnBlock}>
          <div className={styles.askAiTurnHeader}>
            <span className={styles.askAiTurnTitle}>Interaction #{index + 1}</span>
            <button
              type="button"
              className={styles.askAiDiscardBtn}
              onClick={() => actions.discardTurn(turn.id)}
              title="Discard this Q&A block from conversational context"
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.askAiTranscriptBox}>
            <div className={styles.askAiTranscriptTitle}>Your Question:</div>
            <div className={styles.askAiTranscriptText}>{turn.transcript}</div>
          </div>

          <div className={styles.askAiAnswerBox}>
            <div className={styles.askAiTranscriptTitle}>AI Answer:</div>
            <div className={styles.askAiAnswerText}>
              <MarkdownContent content={turn.answer} />
            </div>
          </div>

          {turn.audioAssets.length > 0 && (
            <div className={styles.askAiAnswerPlayer}>
              <LargePlayableControl
                onClick={() => actions.toggleHistoryAudio(turn.id)}
                isPlaying={turn.audioPlaying}
                intentClass={sharedStyles.btnGreen}
                assets={turn.audioAssets}
                onSequenceEnd={() => actions.historyPlaybackEnded(turn.id)}
              />
            </div>
          )}
        </div>
      ))}

      {isRecording && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={styles.askAiPulse} />
            <span>Recording Ask AI question...</span>
          </div>
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnRed,
              )}
              onClick={actions.stopAndSend}
              disabled={!!phase}
            >
              Stop &amp; Send
            </button>
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnBlue,
              )}
              onClick={actions.startTyping}
            >
              Type Instead
            </button>
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnSlate,
              )}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isTyping && <TypedQuestionForm onSend={actions.sendTyped} onCancel={actions.cancel} />}

      {transcript && (
        <div className={styles.askAiTranscriptBox}>
          <div className={styles.askAiTranscriptTitle}>Your Question:</div>
          <div className={styles.askAiTranscriptText}>{transcript}</div>
        </div>
      )}

      {phase && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span
              className={cx(
                sharedStyles.spinner,
                sharedStyles.spinnerSm,
                sharedStyles.spinnerCurrentColor,
              )}
              role="status"
              aria-hidden="true"
            />
            <span>{phase}...</span>
          </div>
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnSlate,
              )}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className={styles.errorMessage}>Ask AI Error: {error}</div>}

      {showSessionActions && (
        <div className={styles.askAiSessionActions}>
          {showFollowUp && (
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnBlue,
              )}
              onClick={() => actions.start(false)}
            >
              <Mic className={sharedStyles.buttonIcon} />
              <span>Ask Follow Up</span>
            </button>
          )}
          {showFollowUp && (
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnBlue,
              )}
              onClick={actions.startTyping}
            >
              Type Follow Up
            </button>
          )}
          {showCancelSession && (
            <button
              type="button"
              className={cx(
                sharedStyles.actionButton,
                sharedStyles.buttonTouchMd,
                sharedStyles.buttonWrap,
                sharedStyles.btnSlate,
              )}
              onClick={actions.cancelSession}
            >
              Cancel Session
            </button>
          )}
        </div>
      )}
    </div>
  );
}