import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { MarkdownContent } from '../../components/MarkdownContent';
import { AudioPlayer } from '../AudioPlayer';
import type { AudioAsset } from '../types';
import { QuizModal } from './QuizModal';
import styles from './modalContent.module.css';

interface HintModalProps {
  hint: string | null;
  images: string[];
  /** Hint narration, present only when the reader has audio switched on. */
  assets: AudioAsset[];
  onClose: () => void;
}

export function HintModal({ hint, images, assets, onClose }: HintModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <QuizModal title="Hint" onClose={onClose}>
      {assets.length > 0 && (
        <div className={styles.playerRow}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={() => setIsPlaying((playing) => !playing)}
          >
            {isPlaying ? (
              <Pause className={styles.playIcon} />
            ) : (
              <Play className={styles.playIcon} />
            )}
            <span>{isPlaying ? 'Pause' : 'Play hint'}</span>
          </button>

          <AudioPlayer
            assets={assets}
            isPlaying={isPlaying}
            onSequenceEnd={() => setIsPlaying(false)}
          />
        </div>
      )}

      {hint && (
        <div className={styles.prose}>
          <MarkdownContent content={hint} />
        </div>
      )}

      {images.map((image) => (
        <img key={image} src={image} alt="" className={styles.image} />
      ))}
    </QuizModal>
  );
}
