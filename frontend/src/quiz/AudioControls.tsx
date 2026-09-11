import {
  useState,
  useCallback,
  useEffect,
  type ButtonHTMLAttributes,
} from 'react';
import { BookOpen, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import type { AudioAsset } from './types';
import type { QuizController } from './useQuizController';
import styles from './QuizPage.module.css';
import sharedStyles from '../styles/shared.module.css';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type LargeActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * A primary quiz control: the shared button base at the largest touch tier.
 * The tier collapses onto the app-wide control at desktop width, so the same
 * element is a thumb target on a phone and an ordinary button on a desktop.
 */
export function LargeActionButton({
  className,
  children,
  type = 'button',
  ...props
}: LargeActionButtonProps) {
  return (
    <button
      type={type}
      className={cx(sharedStyles.actionButton, sharedStyles.buttonTouchLg, className)}
      {...props}
    >
      {children}
    </button>
  );
}

interface LargePlayableControlProps {
  onClick: () => void;
  isPlaying: boolean;
  /** Intent modifier, so the player reads as the control it replaced. */
  intentClass?: string;
  assets: AudioAsset[];
  onSequenceEnd: () => void;
}

export function LargePlayableControl({
  onClick,
  isPlaying,
  intentClass,
  assets,
  onSequenceEnd,
}: LargePlayableControlProps) {
  const [wasEverPlaying, setWasEverPlaying] = useState(false);

  useEffect(() => {
    if (isPlaying) setWasEverPlaying(true);
  }, [isPlaying]);

  const handleSequenceEnd = useCallback(() => {
    setWasEverPlaying(false);
    onSequenceEnd();
  }, [onSequenceEnd]);

  return (
    <div className={cx(styles.playerPanel, intentClass)}>
      <button type="button" onClick={onClick} className={styles.playerToggle}>
        {isPlaying ? (
          <Pause className={sharedStyles.buttonIcon} />
        ) : (
          <Play className={sharedStyles.buttonIcon} />
        )}
        <span>{isPlaying ? 'Pause' : wasEverPlaying ? 'Resume' : 'Play'}</span>
      </button>

      <AudioPlayer assets={assets} isPlaying={isPlaying} onSequenceEnd={handleSequenceEnd} />
    </div>
  );
}

/* ---- the quiz's primary controls ----
   Shared, so the phone layout and the desktop audio plane each place the same
   control instead of building one of their own. */

interface QuizControlProps {
  quiz: QuizController;
}

/** Reads the question aloud: a button until it starts, then the player. */
export function ReadQuestionControl({ quiz }: QuizControlProps) {
  if (quiz.questionActive) {
    return (
      <LargePlayableControl
        onClick={quiz.actions.readQuestion}
        isPlaying={quiz.questionPlaying}
        intentClass={sharedStyles.btnAmber}
        assets={quiz.questionAssets}
        onSequenceEnd={quiz.actions.questionEnded}
      />
    );
  }

  return (
    <LargeActionButton
      onClick={quiz.actions.readQuestion}
      disabled={quiz.questionAssets.length === 0 || quiz.isSubmitting}
      className={sharedStyles.btnAmber}
    >
      <Volume2 className={sharedStyles.buttonIcon} />
      <span>Read Question</span>
    </LargeActionButton>
  );
}

/**
 * Reveals the answer. A full-sized page offers one under the answer field and
 * one in the audio plane; either reveals the answer, and the plane's is the one
 * that then plays it.
 */
export function GetAnswerButton({ quiz }: QuizControlProps) {
  return (
    <LargeActionButton
      onClick={quiz.actions.getAnswer}
      disabled={quiz.isSubmitting}
      className={sharedStyles.btnBlue}
    >
      <BookOpen className={sharedStyles.buttonIcon} />
      <span>Get Answer</span>
    </LargeActionButton>
  );
}

/** Plays the revealed answer. */
export function AnswerPlayer({ quiz }: QuizControlProps) {
  return (
    <LargePlayableControl
      onClick={quiz.actions.toggleAnswerAudio}
      isPlaying={quiz.answerPlaying}
      intentClass={sharedStyles.btnBlue}
      assets={quiz.answerAssets}
      onSequenceEnd={quiz.actions.answerEnded}
    />
  );
}

interface ToggleButtonProps {
  on: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

/** An audio on/off switch. Green reads as on, amber as off. */
export function ToggleButton({ on, label, disabled = false, onClick }: ToggleButtonProps) {
  const Icon = on ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        sharedStyles.actionButton,
        sharedStyles.buttonTouchSm,
        sharedStyles.buttonWrap,
        on ? sharedStyles.btnGreen : sharedStyles.btnAmber,
      )}
    >
      <Icon className={sharedStyles.buttonIcon} />
      <span>{`${label}: ${on ? 'ON' : 'OFF'}`}</span>
    </button>
  );
}
