import { useCallback, useState } from 'react';

/**
 * How the reader wants to take the quiz.
 *
 * `audioEnabled` is the master switch: with it off the page never requests
 * text-to-speech, never asks for the microphone, and hides every playback
 * control. `autoPlay` is nested under it and only has meaning while audio is
 * on.
 *
 * Preferences are per-device rather than per-account, because whether you want
 * a talking quiz depends on where you are, not on who you are.
 */
export interface QuizMode {
  audioEnabled: boolean;
  autoPlay: boolean;
}

const AUDIO_ENABLED_KEY = 'quiz_audio_enabled';
const AUTO_PLAY_KEY = 'quiz_auto_play';

/** Audio is on out of the box, so an untouched install behaves like audio mode. */
const DEFAULT_AUDIO_ENABLED = true;

/**
 * Mirrors the width at which the quiz stops laying itself out for a thumb
 * (see the touch-tier collapse in `styles/global.css`). A media query cannot
 * read a custom property, so the number is stated in both places.
 */
const FULL_SIZED_PAGE = '(min-width: 900px)';

/**
 * A phone quiz is usually taken hands-free, so it reads the question by itself.
 * A full-sized page is not: audio starting unbidden on a desktop is a surprise,
 * so auto-play stays off there until it is asked for. Either way an explicit
 * choice, once made, is what counts — this is only the untouched default.
 */
function defaultAutoPlay(): boolean {
  try {
    return !window.matchMedia(FULL_SIZED_PAGE).matches;
  } catch {
    // No matchMedia is a very old or very small browser; assume a phone.
    return true;
  }
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    // Private browsing modes can throw on access; the default is good enough.
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // A preference that cannot be persisted still applies for this session.
  }
}

export function useQuizMode() {
  const [audioEnabled, setAudioEnabled] = useState(() =>
    readFlag(AUDIO_ENABLED_KEY, DEFAULT_AUDIO_ENABLED),
  );
  const [autoPlay, setAutoPlay] = useState(() =>
    readFlag(AUTO_PLAY_KEY, defaultAutoPlay()),
  );

  const toggleAudioEnabled = useCallback(() => {
    setAudioEnabled((previous) => {
      const next = !previous;
      writeFlag(AUDIO_ENABLED_KEY, next);
      return next;
    });
  }, []);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((previous) => {
      const next = !previous;
      writeFlag(AUTO_PLAY_KEY, next);
      return next;
    });
  }, []);

  return {
    audioEnabled,
    autoPlay: audioEnabled && autoPlay,
    toggleAudioEnabled,
    toggleAutoPlay,
  };
}
