import {
  useState,
  useCallback,
  useEffect,
  type ButtonHTMLAttributes,
} from 'react';
import { Pause, Play } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import type { AudioAsset } from './types';
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
