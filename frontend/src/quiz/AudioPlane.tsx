import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import {
  AnswerPlayer,
  GetAnswerButton,
  ReadQuestionControl,
  ToggleButton,
} from './AudioControls';
import type { QuizController } from './useQuizController';
import type { QuizMode } from './useQuizMode';
import sharedStyles from '../styles/shared.module.css';
import styles from './AudioPlane.module.css';

interface AudioPlaneProps {
  quiz: QuizController;
  mode: QuizMode;
  onAskAi?: () => void;
  askAiDisabled?: boolean;
  /** The voice-command system, mounted once by the page that owns the mic. */
  children?: ReactNode;
}

/**
 * The column of audio controls beside the question on a full-sized page.
 *
 * Audio is the one thing on this page a reader turns on and off wholesale, so
 * the switch is the plane's first control and everything audio hangs under it.
 */
export function AudioPlane({
  quiz,
  mode,
  onAskAi,
  askAiDisabled,
  children,
}: AudioPlaneProps) {
  return (
    <aside className={styles.plane}>
      {onAskAi && quiz.currentQuestion && (
        <button
          type="button"
          onClick={onAskAi}
          disabled={quiz.isSubmitting || askAiDisabled}
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonTouchSm} ${sharedStyles.buttonWrap} ${sharedStyles.btnCyan}`}
        >
          <Sparkles className={sharedStyles.buttonIcon} />
          <span>Ask AI</span>
        </button>
      )}

      <ToggleButton
        on={mode.audioEnabled}
        label="Audio"
        disabled={quiz.isSubmitting}
        onClick={mode.toggleAudioEnabled}
      />

      {mode.audioEnabled && (
        <>
          <ToggleButton
            on={mode.autoPlay}
            label="Auto-Play"
            disabled={quiz.isSubmitting}
            onClick={mode.toggleAutoPlay}
          />

          {children}

          {quiz.currentQuestion && (
            <>
              <ReadQuestionControl quiz={quiz} />
              {!quiz.answerRevealed && <GetAnswerButton quiz={quiz} />}
              {quiz.answerActive && <AnswerPlayer quiz={quiz} />}
            </>
          )}
        </>
      )}
    </aside>
  );
}
