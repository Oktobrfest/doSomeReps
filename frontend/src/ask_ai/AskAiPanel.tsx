import { MarkdownContent } from '../components/MarkdownContent';
import { cx, LargePlayableControl } from '../quiz/AudioControls';
import { X, Mic } from 'lucide-react';
import sharedStyles from '../styles/shared.module.css';
import styles from './AskAiPanel.module.css';
import type { AskAiState } from './types';

interface AskAiPanelProps {
  state: AskAiState;
}

export function AskAiPanel({ state }: AskAiPanelProps) {
  const {
    isRecording,
    phase,
    transcript,
    error,
    history,
    availableImageCount,
    includeImages,
    actions,
  } = state;

  const hasContent =
    isRecording || phase !== null || transcript !== null || error !== null || history.length > 0;

  if (!hasContent) return null;

  return (
    <div className={styles.askAiPanel}>
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
            <div className={styles.askAiTranscriptTitle}>AI Tutor Answer:</div>
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
              className={cx(sharedStyles.actionButton, sharedStyles.btnRed)}
              onClick={actions.stopAndSend}
              disabled={!!phase}
            >
              Stop &amp; Send
            </button>
            <button
              type="button"
              className={cx(sharedStyles.actionButton, sharedStyles.btnSlate)}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              className={cx(sharedStyles.actionButton, sharedStyles.btnSlate)}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className={styles.errorMessage}>Ask AI Error: {error}</div>}

      <div className={styles.askAiSessionActions}>
        {!isRecording && !phase && (
          <button
            type="button"
            className={cx(sharedStyles.actionButton, sharedStyles.btnBlue)}
            onClick={() => actions.start(false)}
          >
            <Mic className={sharedStyles.buttonIcon} />
            <span>Ask Follow Up</span>
          </button>
        )}
        <button
          type="button"
          className={cx(sharedStyles.actionButton, sharedStyles.btnSlate)}
          onClick={actions.cancelSession}
        >
          Cancel Session
        </button>
      </div>
    </div>
  );
}