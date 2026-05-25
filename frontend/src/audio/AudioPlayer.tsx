import { useEffect, useRef, useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';
import type { AudioAsset } from './types';

interface AudioPlayerProps {
  assets: AudioAsset[];
  isPlaying: boolean;
  onSequenceEnd: () => void;
  onTogglePause: () => void;
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
  onTogglePause,
}: AudioPlayerProps) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  const currentAudio = audioRefs.current[trackIndex] ?? null;

  // React to isPlaying changes — play or pause the current track.
  useEffect(() => {
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
    (values: number[]) => {
      if (!currentAudio || !isFinite(duration) || duration <= 0) return;
      const pct = values[0];
      currentAudio.currentTime = (pct / 100) * duration;
      setCurrentTime(currentAudio.currentTime);
    },
    [currentAudio, duration]
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
          className="hidden"
        />
      ))}

      {/* Slider + pause toggle. Don't let clicks bubble to outer button. */}
      <div
        className="flex w-full flex-col items-center gap-1.5 px-2 pt-1"
        onClick={stop}
        onPointerDown={stop}
        onTouchStart={stop}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => { stop(e); onTogglePause(); }}
          className="h-7 gap-1.5 text-sm font-medium text-white hover:bg-white/15 hover:text-white"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isPlaying ? 'Pause' : 'Resume'}
        </Button>

        <Slider
          value={[pct]}
          onValueChange={handleSeek}
          min={0}
          max={100}
          step={0.1}
          onClick={stop}
          onPointerDown={stop}
          className="w-full max-w-xs"
        />

        <div className="text-xs font-medium text-white/90 select-none">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </>
  );
}