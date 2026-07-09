import { useCallback, useEffect, useRef, useState } from 'react';
import { getCsrfToken } from './csrf';
import { base64ToBlob } from './audioUtils';
import type { AudioAsset, Question } from './types';

const logDebug = (message: string, ...args: any[]) => {
  if (import.meta.env.DEV) console.log(`[AskAI] ${message}`, ...args);
};

interface UseAskAiOptions {
  question?: Question | null;
  answerRevealed?: boolean;
  onResumeListening?: () => void;
}

export interface AskAiState {
  isActive: boolean;
  isRecording: boolean;
  phase: string | null;
  transcript: string | null;
  answer: string | null;
  error: string | null;
  audioAssets: AudioAsset[];
  audioPlaying: boolean;
  actions: {
    start: (wasListening: boolean) => Promise<void>;
    stopAndSend: () => void;
    cancel: () => void;
    toggleAudio: () => void;
    playbackEnded: () => void;
  };
}

export function useAskAi({
  question,
  answerRevealed,
  onResumeListening,
}: UseAskAiOptions): AskAiState {
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wasListeningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const playbackActiveRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const onResumeListeningRef = useRef(onResumeListening);

  useEffect(() => {
    onResumeListeningRef.current = onResumeListening;
  }, [onResumeListening]);

  const resumeIfNeeded = useCallback(() => {
    if (wasListeningRef.current) {
      wasListeningRef.current = false;
      onResumeListeningRef.current?.();
    }
  }, []);

  const stopTracks = useCallback((recorder: MediaRecorder | null) => {
    if (recorder && recorder.stream) {
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const revokeCurrentBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const resetPlayback = useCallback(() => {
    playbackActiveRef.current = false;
    setAudioPlaying(false);
    setAudioAssets([]);
    revokeCurrentBlobUrl();
  }, [revokeCurrentBlobUrl]);

  const start = useCallback(
    async (wasListening: boolean) => {
      logDebug('Starting Ask AI recording flow...');
      wasListeningRef.current = wasListening;

      setIsRecording(true);
      setTranscript(null);
      setAnswer(null);
      setError(null);
      setPhase(null);
      chunksRef.current = [];

      try {
        const t_getUserMedia = performance.now();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (import.meta.env.DEV) {
          console.log(
            `[AskAI] getUserMedia took ${(performance.now() - t_getUserMedia).toFixed(1)}ms`,
          );
        }

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        let ondataAvailableCount = 0;
        let ondataAvailableBytes = 0;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            ondataAvailableCount += 1;
            ondataAvailableBytes += e.data.size;
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start();
        (mediaRecorderRef.current as any).__askAiDataCount = () => ondataAvailableCount;
        (mediaRecorderRef.current as any).__askAiDataBytes = () => ondataAvailableBytes;
        logDebug('MediaRecorder started recording Ask AI question.');
      } catch (err) {
        console.error('Failed to start MediaRecorder for Ask AI:', err);
        setError(err instanceof Error ? err.message : String(err));
        setIsRecording(false);
        resumeIfNeeded();
      }
    },
    [resumeIfNeeded],
  );

  const stopAndSend = useCallback(() => {
    logDebug('Stopping Ask AI recording and sending to transcribe...');
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    const t_stop = performance.now();
    (recorder as any).__askAiStopT = t_stop;

    setIsRecording(false);
    setPhase('Transcribing: Question');

    recorder.onstop = async () => {
      const t_onstop = performance.now();
      const mrAny = mediaRecorderRef.current as any;
      const stopT = mrAny?.__askAiStopT;
      const stopToOnstop = stopT ? t_onstop - stopT : NaN;
      if (import.meta.env.DEV) {
        console.log(
          `[AskAI] stop()→onstop flush=${stopToOnstop.toFixed(1)}ms chunks=${mrAny?.__askAiDataCount?.() ?? '?'} bytes=${mrAny?.__askAiDataBytes?.() ?? '?'}`,
        );
      }

      stopTracks(mediaRecorderRef.current);

      try {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          throw new Error('Recorded audio is empty.');
        }

        logDebug(`Sending audio chunk to Flask backend. Size: ${audioBlob.size} bytes`);
        const formData = new FormData();
        formData.append('audio', audioBlob, 'ask-ai-question.webm');

        const headers: Record<string, string> = {};
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
          headers['X-CSRFToken'] = csrfToken;
        }

        const abort = new AbortController();
        abortRef.current = abort;
        const t_fetchStart = performance.now();
        const response = await fetch('/api/ask-ai/transcribe', {
          method: 'POST',
          headers,
          body: formData,
          signal: abort.signal,
        });
        if (import.meta.env.DEV) {
          console.log(
            `[AskAI] transcribe fetch=${(performance.now() - t_fetchStart).toFixed(1)}ms (status=${response.status})`,
          );
        }

        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `Server responded with ${response.status}`);
        }

        if (import.meta.env.DEV) {
          console.log(
            `[AskAI] transcript received (len=${(result.transcript ?? '').length}); total stop→transcript=${(performance.now() - (stopT ?? t_onstop)).toFixed(1)}ms`,
          );
        }
        setTranscript(result.transcript);
        setPhase(null);

        await requestAnswer(result.transcript);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          logDebug('Ask AI transcribe request was cancelled.');
        } else {
          console.error('Failed to transcribe Ask AI audio:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setPhase(null);
        mediaRecorderRef.current = null;
        abortRef.current = null;
      }
    };

    recorder.stop();
  }, [stopTracks]);

  const requestAnswer = useCallback(
    async (transcriptText: string) => {
      if (!question || !question.question_id) {
        setError('No active question context to ask the AI about.');
        resumeIfNeeded();
        return;
      }

      const answerText = answerRevealed ? question.answer : '';
      const body = {
        transcript: transcriptText,
        question_text: question.question_text,
        question_id: question.question_id,
        answer_text: answerText,
        categories: question.categories ?? [],
        image_urls: (question.pics?.question_image ?? []).filter(Boolean) as string[],
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
        headers['X-CSRFToken'] = csrfToken;
      }

      setPhase('Thinking');
      setError(null);
      setAnswer(null);

      try {
        const abort = new AbortController();
        abortRef.current = abort;
        const t_llmStart = performance.now();
        const response = await fetch('/api/ask-ai', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: abort.signal,
        });
        if (import.meta.env.DEV) {
          console.log(
            `[AskAI] LLM fetch=${(performance.now() - t_llmStart).toFixed(1)}ms (status=${response.status})`,
          );
        }

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `Server responded with ${response.status}`);
        }

        const answerText = result.answer_text || '';
        const language = result.language || '';
        setAnswer(answerText);
        setPhase(null);

        setPhase('Transcribing: Answer');
        const speakAbort = new AbortController();
        abortRef.current = speakAbort;
        const t_speakStart = performance.now();
        const speakResponse = await fetch('/api/ask-ai/speak', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: answerText, language }),
          signal: speakAbort.signal,
        });
        if (import.meta.env.DEV) {
          console.log(
            `[AskAI] TTS fetch=${(performance.now() - t_speakStart).toFixed(1)}ms (status=${speakResponse.status})`,
          );
        }

        const speakResult = await speakResponse.json().catch(() => ({}));
        if (!speakResponse.ok || !speakResult.ok) {
          throw new Error(speakResult.error || `Server responded with ${speakResponse.status}`);
        }

        const audioB64 = speakResult.audio_b64 || null;
        const contentType = speakResult.audio_content_type || 'audio/mpeg';
        if (speakResult.warning) {
          console.warn('Ask AI speak warning:', speakResult.warning);
        }
        setPhase(null);

        if (audioB64) {
          const blob = base64ToBlob(audioB64, contentType);
          const blobUrl = URL.createObjectURL(blob);
          revokeCurrentBlobUrl();
          blobUrlRef.current = blobUrl;
          playbackActiveRef.current = true;
          setAudioAssets([{ url: blobUrl, lang: language || 'en_US' }]);

          const callbacks = window.__audioStopCallbacks;
          if (Array.isArray(callbacks)) {
            callbacks.forEach((cb) => {
              try {
                cb?.();
              } catch {
                /* ignore */
              }
            });
          }
          setAudioPlaying(true);
        }
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          logDebug('Ask AI answer request was cancelled.');
        } else {
          console.error('Ask AI answer request failed:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        abortRef.current = null;
        setPhase(null);
        if (!playbackActiveRef.current) {
          resumeIfNeeded();
        }
      }
    },
    [answerRevealed, question, resumeIfNeeded, revokeCurrentBlobUrl],
  );

  const cancel = useCallback(() => {
    logDebug('Cancelling Ask AI (any phase)...');

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        /* ignore */
      }
      abortRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        stopTracks(recorder);
        mediaRecorderRef.current = null;
      };
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    } else if (recorder) {
      stopTracks(recorder);
      mediaRecorderRef.current = null;
    }

    resetPlayback();

    setIsRecording(false);
    setPhase(null);
    setTranscript(null);
    setAnswer(null);
    setError(null);
    resumeIfNeeded();
  }, [resetPlayback, resumeIfNeeded, stopTracks]);

  const playbackEnded = useCallback(() => {
    logDebug('Ask AI answer playback ended.');
    playbackActiveRef.current = false;
    setAudioPlaying(false);
    resumeIfNeeded();
  }, [resumeIfNeeded]);

  const toggleAudio = useCallback(() => {
    setAudioPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    const stopMe = () => {
      setAudioPlaying(false);
    };
    if (!window.__audioStopCallbacks) {
      window.__audioStopCallbacks = [];
    }
    window.__audioStopCallbacks.push(stopMe);
    return () => {
      const arr = window.__audioStopCallbacks;
      if (arr) {
        const idx = arr.indexOf(stopMe);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }, []);

  const isActive = isRecording || phase !== null || transcript !== null || answer !== null || error !== null;

  return {
    isActive,
    isRecording,
    phase,
    transcript,
    answer,
    error,
    audioAssets,
    audioPlaying,
    actions: {
      start,
      stopAndSend,
      cancel,
      toggleAudio,
      playbackEnded,
    },
  };
}
