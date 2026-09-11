import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { csrfHeaders, jsonHeaders } from '../lib/http';
import { base64ToBlob } from '../quiz/audioUtils';
import type { AskAiContext, AskAiState, AskAiTurn } from './types';

const logDebug = (message: string, ...args: any[]) => {
  if (import.meta.env.DEV) console.log(`[AskAI] ${message}`, ...args);
};

interface UseAskAiOptions {
  context: AskAiContext | null;
  answerRevealed?: boolean;
  onResumeListening?: () => void;
}

export function useAskAi({
  context,
  answerRevealed = false,
  onResumeListening,
}: UseAskAiOptions): AskAiState {
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AskAiTurn[]>([]);
  const [includeImages, setIncludeImages] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wasListeningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const playbackActiveRef = useRef(false);

  const blobUrlsRef = useRef<Set<string>>(new Set());

  const contextRef = useRef(context);
  const answerRevealedRef = useRef(answerRevealed);
  const includeImagesRef = useRef(includeImages);
  const historyRef = useRef(history);
  const onResumeListeningRef = useRef(onResumeListening);

  useEffect(() => { contextRef.current = context; }, [context]);
  useEffect(() => { answerRevealedRef.current = answerRevealed; }, [answerRevealed]);
  useEffect(() => { includeImagesRef.current = includeImages; }, [includeImages]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { onResumeListeningRef.current = onResumeListening; }, [onResumeListening]);

  const availableImageUrls = useMemo(() => {
    if (!context) return [] as string[];
    const urls = [...(context.questionImageUrls ?? [])];
    if (answerRevealed) urls.push(...(context.answerImageUrls ?? []));
    return urls.filter((u): u is string => !!u);
  }, [context, answerRevealed]);

  const availableImageUrlsRef = useRef(availableImageUrls);
  useEffect(() => { availableImageUrlsRef.current = availableImageUrls; }, [availableImageUrls]);

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

  const revokeAll = useCallback(() => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current.clear();
  }, []);

  const clearHistory = useCallback(() => {
    revokeAll();
    setHistory([]);
  }, [revokeAll]);

  useEffect(() => revokeAll, [revokeAll]);

  const start = useCallback(
    async (wasListening: boolean = false) => {
      wasListeningRef.current = wasListening;
      setIsRecording(true);
      setTranscript(null);
      setError(null);
      setPhase(null);
      chunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.start();
        logDebug('MediaRecorder started.');
      } catch (err) {
        console.error('Failed to start MediaRecorder for Ask AI:', err);
        setError(err instanceof Error ? `Microphone unavailable: ${err.message}` : String(err));
        setIsRecording(false);
        resumeIfNeeded();
      }
    },
    [resumeIfNeeded],
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* ignore */ }
      abortRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        stopTracks(recorder);
        mediaRecorderRef.current = null;
      };
      try { recorder.stop(); } catch { /* ignore */ }
    } else if (recorder) {
      stopTracks(recorder);
      mediaRecorderRef.current = null;
    }

    playbackActiveRef.current = false;
    setIsRecording(false);
    setPhase(null);
    setTranscript(null);
    setError(null);
    resumeIfNeeded();
  }, [resumeIfNeeded, stopTracks]);

  const requestAnswer = useCallback(
    async (transcriptText: string) => {
      const ctx = contextRef.current;
      if (!ctx || ctx.questionId == null || ctx.questionId === '') {
        setError('No active question context to ask the AI about.');
        resumeIfNeeded();
        return;
      }

      const body = {
        transcript: transcriptText,
        question_text: ctx.questionText,
        question_id: ctx.questionId,
        answer_text: answerRevealedRef.current ? (ctx.answerText || '') : '',
        categories: ctx.categories ?? [],
        image_urls: includeImagesRef.current ? availableImageUrlsRef.current : [],
        history: historyRef.current.map((t) => ({ transcript: t.transcript, answer: t.answer })),
      };

      setPhase('Thinking');
      setError(null);

      try {
        const abort = new AbortController();
        abortRef.current = abort;
        const response = await fetch('/api/ask-ai', {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(body),
          signal: abort.signal,
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `Server responded with ${response.status}`);
        }

        const answerText: string = result.answer_text || '';
        const language: string = result.language || '';

        let audioB64: string | null = null;
        let contentType = 'audio/mpeg';

        try {
          setPhase('Transcribing: Answer');
          const speakAbort = new AbortController();
          abortRef.current = speakAbort;
          const speakResponse = await fetch('/api/ask-ai/speak', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ text: answerText, language }),
            signal: speakAbort.signal,
          });

          const speakResult = await speakResponse.json().catch(() => ({}));
          if (speakResponse.ok && speakResult.ok) {
            audioB64 = speakResult.audio_b64 || null;
            contentType = speakResult.audio_content_type || 'audio/mpeg';
            if (speakResult.warning) console.warn('Ask AI speak warning:', speakResult.warning);
          }
        } catch (err) {
          console.error('Ask AI speak call failed:', err);
        } finally {
          setPhase(null);
        }

        const id = Math.random().toString(36).slice(2, 10);
        let newTurn: AskAiTurn;

        if (audioB64) {
          const blobUrl = URL.createObjectURL(base64ToBlob(audioB64, contentType));
          blobUrlsRef.current.add(blobUrl);

          window.__audioStopCallbacks?.forEach((cb) => {
            try { cb?.(); } catch { /* ignore */ }
          });
          
          playbackActiveRef.current = true;

          newTurn = {
            id,
            transcript: transcriptText,
            answer: answerText,
            audioAssets: [{ url: blobUrl, lang: language || 'en_US' }],
            audioPlaying: true,
          };
        } else {
          newTurn = {
            id,
            transcript: transcriptText,
            answer: answerText,
            audioAssets: [],
            audioPlaying: false,
          };
        }

        setHistory((prev) => [...prev, newTurn]);
        setTranscript(null);
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
        if (!playbackActiveRef.current) resumeIfNeeded();
      }
    },
    [resumeIfNeeded],
  );

  const stopAndSend = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setIsRecording(false);
    setPhase('Transcribing: Question');

    recorder.onstop = async () => {
      stopTracks(mediaRecorderRef.current);

      try {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) throw new Error('Recorded audio is empty.');

        const formData = new FormData();
        formData.append('audio', audioBlob, 'ask-ai-question.webm');

        const abort = new AbortController();
        abortRef.current = abort;
        const response = await fetch('/api/ask-ai/transcribe', {
          method: 'POST',
          headers: csrfHeaders(),
          body: formData,
          signal: abort.signal,
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `Server responded with ${response.status}`);
        }

        setTranscript(result.transcript);
        await requestAnswer(result.transcript);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          logDebug('Ask AI transcribe request was cancelled.');
        } else {
          console.error('Failed to transcribe Ask AI audio:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
        setPhase(null);
      } finally {
        mediaRecorderRef.current = null;
        abortRef.current = null;
      }
    };

    recorder.stop();
  }, [stopTracks, requestAnswer]);

  const cancelSession = useCallback(() => {
    cancel();
    clearHistory();
  }, [cancel, clearHistory]);

  const questionKey = context?.questionId ?? null;
  useEffect(() => {
    cancel();
    clearHistory();
    setIncludeImages(false);
  }, [questionKey, cancel, clearHistory]);

  const toggleHistoryAudio = useCallback((id: string) => {
    setHistory((prev) =>
      prev.map((turn) => {
        if (turn.id !== id) return { ...turn, audioPlaying: false };
        const nextPlaying = !turn.audioPlaying;
        if (nextPlaying) {
          window.__audioStopCallbacks?.forEach((cb) => {
            try { cb?.(); } catch { /* ignore */ }
          });
          playbackActiveRef.current = true;
        }
        return { ...turn, audioPlaying: nextPlaying };
      }),
    );
  }, []);

  const historyPlaybackEnded = useCallback(
    (id: string) => {
      setHistory((prev) =>
        prev.map((turn) => (turn.id === id ? { ...turn, audioPlaying: false } : turn)),
      );
      playbackActiveRef.current = false;
      resumeIfNeeded();
    },
    [resumeIfNeeded],
  );

  const discardTurn = useCallback((id: string) => {
    const turn = historyRef.current.find((t) => t.id === id);
    turn?.audioAssets.forEach((a) => {
      if (blobUrlsRef.current.delete(a.url)) URL.revokeObjectURL(a.url);
    });
    setHistory((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const stopMe = () => {
      setHistory((prev) =>
        prev.map((turn) => (turn.audioPlaying ? { ...turn, audioPlaying: false } : turn)),
      );
      playbackActiveRef.current = false;
    };
    if (!window.__audioStopCallbacks) window.__audioStopCallbacks = [];
    window.__audioStopCallbacks.push(stopMe);
    return () => {
      const arr = window.__audioStopCallbacks;
      if (arr) {
        const idx = arr.indexOf(stopMe);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }, []);

  const isActive =
    isRecording || phase !== null || transcript !== null || error !== null || history.length > 0;

  const actions = useMemo(
    () => ({
      start,
      stopAndSend,
      cancel,
      cancelSession,
      toggleHistoryAudio,
      historyPlaybackEnded,
      discardTurn,
      setIncludeImages,
    }),
    [start, stopAndSend, cancel, cancelSession, toggleHistoryAudio, historyPlaybackEnded, discardTurn],
  );

  return {
    isActive,
    isRecording,
    phase,
    transcript,
    error,
    history,
    availableImageCount: availableImageUrls.length,
    includeImages,
    actions,
  };
}