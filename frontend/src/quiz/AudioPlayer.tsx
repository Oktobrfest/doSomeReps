import { useEffect, useRef, useState, useCallback } from 'react';
import type { AudioAsset } from './types';
import styles from './AudioPlayer.module.css';
import {
  acquireMediaSessionKeepAlive,
  releaseMediaSessionKeepAlive,
} from './mediaSessionKeepAlive';

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

  // Create an array of refs for audio elements
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  // Track whether THIS player instance currently holds a
  // keep-alive reference, so acquire/release stay balanced.
  const keepAliveHeldRef = useRef(false);

  // Single release path used by sequence end, asset swap and unmount.
  const releaseKeepAlive = useCallback(() => {
    if (keepAliveHeldRef.current) {
      keepAliveHeldRef.current = false;
      releaseMediaSessionKeepAlive();
    }
  }, []);

  // Release on unmount. LargePlayableControl unmounts this player
  // whenever the active audio source flips, so this must never leak a hold.
  useEffect(() => releaseKeepAlive, [releaseKeepAlive]);

  // 1. Reset all audio elements and state when the asset list changes (moving to a new question/answer)
  useEffect(() => {
    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.pause();
        try { audio.currentTime = 0; } catch { /* ignore */ }
      }
    });
    releaseKeepAlive();
    setTrackIndex(0);
    setCurrentTime(0);
    setDuration(0);
  }, [assets, releaseKeepAlive]);

  // 2. Play or Pause the active audio element based on `isPlaying` and `trackIndex`
  useEffect(() => {
    const activeAudio = audioRefs.current[trackIndex];
    if (!activeAudio) return;

    // Sync duration immediately if already loaded
    if (isFinite(activeAudio.duration) && activeAudio.duration > 0) {
      setDuration(activeAudio.duration);
    } else {
      setDuration(0);
    }

    if (isPlaying) {
      if (!keepAliveHeldRef.current) {
        keepAliveHeldRef.current = true;
        acquireMediaSessionKeepAlive();
      }

      const playPromise = activeAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error('Audio play failed:', err);
        });
      }
    } else {
      activeAudio.pause();
    }

    // Cleanup: pause active audio if index changes or player unmounts
    return () => {
      activeAudio.pause();
    };
  }, [isPlaying, trackIndex]);

  // 3. Handle when the active track ends
  const handleEnded = useCallback(() => {
    if (trackIndex + 1 < assets.length) {
      // Move to next track
      setTrackIndex(trackIndex + 1);
      setCurrentTime(0);
      setDuration(0);
    } else {
      // Sequence completed! Reset all tracks to beginning and notify parent
      audioRefs.current.forEach((audio) => {
        if (audio) {
          try { audio.currentTime = 0; } catch { /* ignore */ }
        }
      });
      releaseKeepAlive();
      setTrackIndex(0);
      setCurrentTime(0);
      setDuration(0);
      onSequenceEnd();
    }
  }, [trackIndex, assets.length, onSequenceEnd, releaseKeepAlive]);

  // 4. Handle time and metadata updates
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audioIndex = audioRefs.current.indexOf(e.currentTarget);
    if (audioIndex === trackIndex) {
      setCurrentTime(e.currentTarget.currentTime);
    }
  }, [trackIndex]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audioIndex = audioRefs.current.indexOf(e.currentTarget);
    if (audioIndex === trackIndex) {
      setDuration(e.currentTarget.duration);
    }
  }, [trackIndex]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const activeAudio = audioRefs.current[trackIndex];
      if (!activeAudio || !isFinite(duration) || duration <= 0) return;
      const pct = parseFloat(e.target.value);
      const newTime = (pct / 100) * duration;
      activeAudio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [trackIndex, duration]
  );

  // Manual track navigation (Prev/Next buttons)
  const prevTrack = useCallback(() => {
    if (trackIndex > 0) {
      const activeAudio = audioRefs.current[trackIndex];
      if (activeAudio) {
        activeAudio.pause();
        try { activeAudio.currentTime = 0; } catch { /* ignore */ }
      }
      setTrackIndex(trackIndex - 1);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [trackIndex]);

  const nextTrack = useCallback(() => {
    if (trackIndex + 1 < assets.length) {
      const activeAudio = audioRefs.current[trackIndex];
      if (activeAudio) {
        activeAudio.pause();
        try { activeAudio.currentTime = 0; } catch { /* ignore */ }
      }
      setTrackIndex(trackIndex + 1);
      setCurrentTime(0);
      setDuration(0);
    } else {
      audioRefs.current.forEach((audio) => {
        if (audio) {
          try { audio.currentTime = 0; } catch { /* ignore */ }
        }
      });
      releaseKeepAlive();
      setTrackIndex(0);
      setCurrentTime(0);
      setDuration(0);
      onSequenceEnd();
    }
  }, [trackIndex, assets.length, onSequenceEnd, releaseKeepAlive]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Hidden audio elements: always attach listeners so metadata is read immediately upon mounting or loading
  return (
    <>
      {assets.map((asset, i) => (
        <audio
          key={`${asset.url}-${i}`}
          ref={(el) => { audioRefs.current[i] = el; }}
          src={asset.url}
          preload="auto"
          data-lang={asset.lang}
          onEnded={i === trackIndex ? handleEnded : undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
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
        {assets.length > 1 && (
          <div className={styles.trackControls}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prevTrack(); }}
              disabled={trackIndex === 0}
              className={styles.navButton}
            >
              ◀ Prev
            </button>
            <span className={styles.trackBadge}>
              {/*<span className={styles.trackLabel}>Track</span>*/}
              <strong className={styles.trackCurrent}>{trackIndex + 1}</strong>
              <span className={styles.trackSeparator}>/</span>
              <span className={styles.trackTotal}>{assets.length}</span>
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); nextTrack(); }}
              disabled={trackIndex + 1 === assets.length}
              className={styles.navButton}
            >
              Next ▶
            </button>
          </div>
        )}

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

        <div className={styles.timeInfo} >
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </>
  );
}