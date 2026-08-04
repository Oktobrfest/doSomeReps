import {
  useState,
  useCallback,
  useEffect,
  type ButtonHTMLAttributes,
} from 'react';
import { Pause, Play } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import type { AudioAsset } from './types';
import styles from './AudioQuiz.module.css';
import actionStyles from '../styles/ActionButton.module.css';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type LargeActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function LargeActionButton({
  className,
  children,
  type = 'button',
  ...props
}: LargeActionButtonProps) {
  return (
    <button type={type} className={cx(actionStyles.largeBtn, className)} {...props}>
      {children}
    </button>
  );
}

interface LargePlayableControlProps {
  onClick: () => void;
  isPlaying: boolean;
  className?: string;
  assets: AudioAsset[];
  onSequenceEnd: () => void;
}

export function LargePlayableControl({
  onClick,
  isPlaying,
  className,
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
    <div className={styles.playableControl}>
      <div className={cx(actionStyles.largeBtn, actionStyles.hasSlider, styles.playableControlInner, className)}>
        <button type="button" onClick={onClick} className={styles.playPauseToggleBtn}>
          {isPlaying ? (
            <Pause className={actionStyles.iconLarge} />
          ) : (
            <Play className={actionStyles.iconLarge} />
          )}
          <span>{isPlaying ? 'Pause' : wasEverPlaying ? 'Resume' : 'Play'}</span>
        </button>

        <AudioPlayer assets={assets} isPlaying={isPlaying} onSequenceEnd={handleSequenceEnd} />
      </div>
    </div>
  );
}