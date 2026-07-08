import { MarkdownContent } from '../components/MarkdownContent';
import { cx, LargePlayableControl } from './AudioControls';
import actionStyles from './ActionButton.module.css';
import styles from './AskAiPanel.module.css';
import type { AskAiState } from './useAskAi';

interface AskAiPanelProps {
  state: AskAiState;
}

export function AskAiPanel({ state }: AskAiPanelProps) {
  const {
    isRecording,
    phase,
    transcript,
    answer,
    error,
    audioAssets,
    audioPlaying,
    actions,
  } = state;

  if (!isRecording && !phase && !transcript && !answer && !error && audioAssets.length === 0) {
    return null;
  }

  return (
    <div className={styles.askAiPanel}>
      {isRecording && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={styles.askAiPulse} />
            <span>Recording Ask AI question...</span>
          </div>
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnStop)}
              onClick={actions.stopAndSend}
              disabled={!!phase}
            >
              Stop & Send
            </button>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={cx(styles.spinnerBorder, styles.spinnerInline)} role="status" aria-hidden="true" />
            <span>{phase}...</span>
          </div>
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          Ask AI Error: {error}
        </div>
      )}

      {transcript && (
        <div className={styles.askAiTranscriptBox}>
          <div className={styles.askAiTranscriptTitle}>Ask AI Transcript:</div>
          <div className={styles.askAiTranscriptText}>{transcript}</div>
        </div>
      )}

      {answer && (
        <div className={styles.askAiAnswerBox}>
          <div className={styles.askAiTranscriptTitle}>AI Tutor Answer:</div>
          <div className={styles.askAiAnswerText}>
            <MarkdownContent content={answer} />
          </div>
        </div>
      )}

      {audioAssets.length > 0 && (
        <div className={styles.askAiAnswerPlayer}>
          <LargePlayableControl
            onClick={actions.toggleAudio}
            isPlaying={audioPlaying}
            className={styles.askAiAnswerPlayerBox}
            assets={audioAssets}
            onSequenceEnd={actions.playbackEnded}
          />
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={actions.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
