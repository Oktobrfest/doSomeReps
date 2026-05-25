import { useEffect, useRef, useState, useCallback } from 'react';
import type { AudioAsset } from './types';
import styles from './AudioPlayer.module.css';

interface AudioPlayerProps {
  assets: AudioAsset[];
  isPlaying: boolean;
  onSequenceEnd: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function AudioPlayer({
  assets,
  isPlaying,
  onSequenceEnd,
}: AudioPlayerProps) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  // React to isPlaying changes — play or pause the current track.
  useEffect(() => {
    const currentAudio = audioRefs.current[trackIndex];
    if (!currentAudio) return;
    if (isPlaying) {
      const p = currentAudio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.error('Audio play failed:', err);
          advanceTrack();
        });
      }
    } else {
      currentAudio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, trackIndex]);

  // Reset when the asset list changes (new question).
  useEffect(() => {
    setTrackIndex(0);
    setCurrentTime(0);
    setDuration(0);
    audioRefs.current.forEach((a) => {
      if (a) {
        a.pause();
        try { a.currentTime = 0; } catch { /* ignore */ }
      }
    });
  }, [assets]);

  const advanceTrack = useCallback(() => {
    setTrackIndex((idx) => {
      const next = idx + 1;
      if (next >= assets.length) {
        queueMicrotask(onSequenceEnd);
        return idx;
      }
      return next;
    });
  }, [assets.length, onSequenceEnd]);

  const handleEnded = useCallback(() => advanceTrack(), [advanceTrack]);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    setDuration(e.currentTarget.duration);
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const currentAudio = audioRefs.current[trackIndex];
      if (!currentAudio || !isFinite(duration) || duration <= 0) return;
      const pct = parseFloat(e.target.value);
      currentAudio.currentTime = (pct / 100) * duration;
      setCurrentTime(currentAudio.currentTime);
    },
    [trackIndex, duration]
  );

  // Stop click events bubbling up to the parent button (which would re-trigger playback).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Hidden audio elements, kept mounted for preload */}
      {assets.map((asset, i) => (
        <audio
          key={`${asset.url}-${i}`}
          ref={(el) => { audioRefs.current[i] = el; }}
          src={asset.url}
          preload="auto"
          data-lang={asset.lang}
          onEnded={i === trackIndex ? handleEnded : undefined}
          onTimeUpdate={i === trackIndex ? handleTimeUpdate : undefined}
          onLoadedMetadata={i === trackIndex ? handleLoadedMetadata : undefined}
          onError={i === trackIndex ? handleEnded : undefined}
          className={styles.hidden}
        />
      ))}

      {/* Slider + playback timer. Don't let clicks bubble to outer button. */}
      <div
        className={styles.sliderContainer}
        onClick={stop}
        onPointerDown={stop}
        onTouchStart={stop}
      >
        <input
          type="range"
          value={pct}
          onChange={handleSeek}
          min={0}
          max={100}
          step={0.1}
          onClick={stop}
          onPointerDown={stop}
          className={styles.slider}
        />

        <div className={styles.timeInfo}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </>
  );
}