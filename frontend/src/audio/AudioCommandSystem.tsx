import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';

import { createPortal } from "react-dom";
import { AudioCommandManager } from "./AudioCommandManager";
import { buildWorkletBlobUrl } from "./audioCapture";
import { KwsWorkerClient } from "./kwsWorkerClient";
import type { WorkerState } from "./kwsWorkerClient";
import { registerAllCommands } from "./commands";
import styles from "./AudioCommandSystem.module.css";
import actionStyles from "./ActionButton.module.css";
import { MarkdownContent } from "../components/MarkdownContent";
import type {
  AudioAsset,
  AudioCommandHandlers,
  CommandCallback,
  Question,
} from './types';
import {
  logMediaStreamDiagnostics,
  logAudioContextDiagnostics,
  logAudioDiagnostic,
  probeAudioContextSampleRateSupport,
} from "./audioDiagnostics";
import { cx, LargePlayableControl } from "./AudioControls";

const AVAILABLE_COMMANDS = [
  "READ QUESTION",
  "GET ANSWER",
  "CORRECT",
  "WRONG",
  "PAUSE",
  "RESUME",
  "RELOAD",
  "ASK AI",
  "STOP LISTENING"
];

// todo: REFACTOR THIS FILE!

interface AudioCommandSystemComponentProps {
  question?: Question | null;
  answerRevealed?: boolean;
  commands?: AudioCommandHandlers;
  commandsDisabled?: boolean;
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function normalizeCommand(command: string) {
  return command.toUpperCase().trim().replace(/\s+/g, ' ');
}

function resolveQuizCommandHandler(
  rawCommand: string,
  handlers: AudioCommandHandlers | undefined,
): CommandCallback | null {
  if (!handlers) return null;

  switch (normalizeCommand(rawCommand)) {
    case 'CORRECT':
      return handlers.correct;

    case 'WRONG':
    case 'INCORRECT':
      return handlers.wrong;

    case 'SLIGHTLY WRONG':
    case 'SLIGHTLY':
    case 'PARTIALLY WRONG':
      return handlers.slightlyWrong;

    case 'GET ANSWER':
    case 'ANSWER':
    case 'SHOW ANSWER':
      return handlers.getAnswer;

    case 'READ QUESTION':
    case 'QUESTION':
      return handlers.readQuestion;

    case 'PAUSE':
      return handlers.pause;

    case 'RESUME':
      return handlers.resume;

    default:
      return null;
  }
}

// AudioWorklet batching: samples accumulated before posting one frame.
// 1280 @48k ≈ 26.7ms ≈ ~37 msgs/sec (vs ~375/sec at the 128-sample default).
// Tune: 512 (lower latency, more msgs) / 1024 / 2048 (less overhead, more latency).
// Does NOT change sample rate or resampling.
const PCM_WORKLET_FRAME_SIZE = 1280;
const dontListenWhenPlayerAudioPlays = false;

function base64ToBlob(b64: string, contentType: string): Blob {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

export function AudioCommandSystemComponent({
  question = null,
  answerRevealed = false,
  commands,
  commandsDisabled = false,
}: AudioCommandSystemComponentProps) {
  const commandsRef = useLatestRef(commands);
  const commandsDisabledRef = useLatestRef(commandsDisabled);
  const [engineState, setEngineState] = useState<WorkerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Ask AI state
  const [isRecordingAskAi, setIsRecordingAskAi] = useState(false);
  // Single phase label driving the one-at-a-time progress spinner. null = idle.
  // Phases: "Transcribing: Question", "Thinking", "Transcribing: Answer".
  const [askAiPhase, setAskAiPhase] = useState<string | null>(null);
  const [askAiTranscript, setAskAiTranscript] = useState<string | null>(null);
  const [askAiAnswer, setAskAiAnswer] = useState<string | null>(null);
  const [askAiError, setAskAiError] = useState<string | null>(null);
  // Audio playback (uses the shared AudioPlayer for seek/pause/etc.)
  const [askAiAudioAssets, setAskAiAudioAssets] = useState<AudioAsset[]>([]);
  const [askAiAudioPlaying, setAskAiAudioPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const askAiChunksRef = useRef<Blob[]>([]);
  const wasListeningBeforeAskAiRef = useRef(false);
  const askAiAbortRef = useRef<AbortController | null>(null);
  const askAiPlaybackActiveRef = useRef(false);
  const askAiBlobUrlRef = useRef<string | null>(null);

  // Refs for audio capture (these stay on the main thread — only PCM routing)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workletUrlRef = useRef<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputSampleRateRef = useRef<number>(44100);

  // Refs for worker and command manager
  const kwsWorkerRef = useRef<KwsWorkerClient | null>(null);
  const commandManagerRef = useRef(new AudioCommandManager());
  const isStartingRef = useRef(false);

  // Custom logging helper to keep everything consistent
  const logDebug = (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) console.log(`[AudioCommandSystem] ${message}`, ...args);
  };

  // Clear detected command display after 6 seconds
  useEffect(() => {
    if (!lastCommand) return;
    const timer = setTimeout(() => setLastCommand(null), 6000);
    return () => clearTimeout(timer);
  }, [lastCommand]);

  // Register/unregister this component's stop callback for global audio coordination.
  useEffect(() => {
    const stopMe = () => {
      setAskAiAudioPlaying(false);
    };
    if (!(window as any).__audioStopCallbacks) {
      (window as any).__audioStopCallbacks = [];
    }
    (window as any).__audioStopCallbacks.push(stopMe);
    return () => {
      const arr: Array<(() => void) | undefined> = (window as any).__audioStopCallbacks;
      if (arr) {
        const idx = arr.indexOf(stopMe);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }, []);

  // Build a stable callback-based interface for the KWS worker
  const runCommand = useCallback((keyword: string) => {
    const quizCommandHandler = resolveQuizCommandHandler(
      keyword,
      commandsRef.current,
    );

    if (quizCommandHandler) {
      if (!commandsDisabledRef.current) {
        quizCommandHandler();
      }
      return;
    }

    // Non-quiz commands, such as Ask AI, Reload, Stop Listening, etc., can still
    // be handled by the existing internal AudioCommandManager registration.
    commandManagerRef.current.triggerCommand(keyword);
  }, [commandsRef, commandsDisabledRef]);

  const handleKeyword = useCallback((keyword: string) => {
    logDebug(`Keyword matched in worker: "${keyword}"`);
    setLastCommand(keyword);

    runCommand(keyword);

    // Reset worker state after detection to avoid repeats.
    kwsWorkerRef.current?.reset();
  }, [runCommand]);

  // Register commands once.
  useEffect(() => {
    logDebug("Registering all audio commands...");
    const manager = commandManagerRef.current;
    registerAllCommands(manager);

    const exitBtn = document.getElementById("exit-audio-mode");
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        logDebug("Exit button clicked; disabling future auto-listen.");
        sessionStorage.setItem("audio_listening_active", "false");
      });
    }

    return () => {
      logDebug("Unmounting component: performing cleanup.");
      stopListeningCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start listening if previously active
  useEffect(() => {
    const wasListening = sessionStorage.getItem("audio_listening_active") === "true";
    logDebug(`Checking auto-start. wasListening: ${wasListening}`);
    if (wasListening) {
      const timer = setTimeout(() => {
        logDebug("Auto-starting audio listening system...");
        void startListening();
      }, 150);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close hamburger menu on outside clicks
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = () => setMenuOpen(false);
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [menuOpen]);

  // ---- Audio capture cleanup (main thread only) ----

  const stopAudioCapture = () => {
    logDebug("Stopping audio capture stream & nodes...");
    try {
      if (workletNodeRef.current) {
        logDebug("Disconnecting AudioWorkletNode...");
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }
      if (sourceRef.current) {
        logDebug("Disconnecting MediaStreamAudioSourceNode...");
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (mediaStreamRef.current) {
        logDebug("Stopping tracks in media stream...");
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        logDebug("Closing AudioContext...");
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (workletUrlRef.current) {
        logDebug("Revoking AudioWorklet object URL...");
        URL.revokeObjectURL(workletUrlRef.current);
        workletUrlRef.current = null;
      }
    } catch (err) {
      console.warn("Error during audio capture cleanup:", err);
    }
  };

  // ---- Full stop: worker + audio capture ----

  const stopListeningCleanup = () => {
    logDebug("Performing stopListeningCleanup...");
    stopAudioCapture();
    if (kwsWorkerRef.current) {
      logDebug("Stopping and terminating KwsWorkerClient...");
      kwsWorkerRef.current.stop();
      kwsWorkerRef.current = null;
    }
    isStartingRef.current = false;
    setEngineState("idle");
    logDebug("Listening cleanup complete.");
  };

  const stopListening = (manual = false) => {
    logDebug(`stopListening called. manual: ${manual}`);
    stopListeningCleanup();
    if (manual) {
      sessionStorage.setItem("audio_listening_active", "false");
    }
  };

  // Expose global stop function
  const stopListeningCb = useCallback(() => stopListening(true), []);
  useEffect(() => {
    (window as any).stopAudioListening = stopListeningCb;
    return () => {
      delete (window as any).stopAudioListening;
    };
  }, [stopListeningCb]);

  // ---- Start listening ----

  const startListening = async () => {
    logDebug(`startListening initiated. isStartingRef: ${isStartingRef.current}, engineState: ${engineState}`);
    if (isStartingRef.current || engineState === "loading") return;
    if (engineState === "listening" || engineState === "ready") {
      logDebug("Already listening or ready, triggering stop instead.");
      stopListening(true);
      return;
    }

    isStartingRef.current = true;
    setEngineState("loading");
    setErrorMsg(null);
    setLastCommand(null);

    try {
      // 1. Start the KWS Web Worker (handles all WASM/model loading off main thread)
      logDebug("Instantiating KwsWorkerClient...");
      const kwsWorker = new KwsWorkerClient({
        onKeyword: handleKeyword,
        onReady: () => {
          logDebug("KWS Worker is ready! Proceeding with audio capture on main thread.");
        },
        onError: (msg) => {
          console.error("[KwsWorkerClient Callback] Error received from worker:", msg);
          setErrorMsg(msg);
          stopListeningCleanup();
        },
        onStateChange: (state) => {
          logDebug(`Worker state changed to: ${state}`);
          // Don't override "listening" with "ready" — audio capture is the final step
          if (state === "ready") return;
          setEngineState(state);
        },
      });

      kwsWorkerRef.current = kwsWorker;
      logDebug("Triggering start on KwsWorkerClient...");
      await kwsWorker.start();

      // 2. Start microphone capture
      // One-time probe: does this device/browser honor a forced 16k context?
      // Throwaway contexts only — does NOT touch the live pipeline. Safe to delete later.
      await probeAudioContextSampleRateSupport(16000);

      logDebug("Requesting microphone permission...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = mediaStream;
      logDebug("Microphone permission granted.");

      // One-time: what did the mic track actually negotiate (rate, channels, AEC/NS/AGC)?
      logMediaStreamDiagnostics(mediaStream);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") {
        logDebug("AudioContext is suspended; resuming now...");
        await audioCtx.resume();
      }
      audioCtxRef.current = audioCtx;

      inputSampleRateRef.current = audioCtx.sampleRate;
      logDebug(`AudioContext active. Sample rate: ${audioCtx.sampleRate}`);

      // One-time: live context details + does the context rate match the mic track rate?
      logAudioContextDiagnostics(audioCtx, "Live AudioContext");
      {
        const _track = mediaStream.getAudioTracks()[0];
        const _settings = _track?.getSettings?.() ?? {};
        logAudioDiagnostic("Sample-rate comparison", {
          audioCtx_sampleRate: audioCtx.sampleRate,
          mediaTrack_sampleRate: (_settings as any).sampleRate,
          mediaTrack_channelCount: (_settings as any).channelCount,
          note: "If these two rates differ, resampling is using the wrong input rate.",
        });
      }

      // Register the PCM capture worklet
      const workletUrl = buildWorkletBlobUrl();
      workletUrlRef.current = workletUrl;
      logDebug("Adding PCM capture worklet module to AudioContext...");
      await audioCtx.audioWorklet.addModule(workletUrl);
      logDebug("PCM capture worklet module successfully loaded.");

      const source = audioCtx.createMediaStreamSource(mediaStream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, "pcm-capture-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        processorOptions: { frameSize: PCM_WORKLET_FRAME_SIZE },
      });
      workletNodeRef.current = workletNode;

      // One-time confirmation; the [KWS] heartbeat shows the resulting frames/sec.
      if (import.meta.env.DEV) {
        console.log(
          "[KWS] worklet batching: frame " + PCM_WORKLET_FRAME_SIZE + " samples (~" +
          ((PCM_WORKLET_FRAME_SIZE / audioCtx.sampleRate) * 1000).toFixed(1) + "ms, ~" +
          (audioCtx.sampleRate / PCM_WORKLET_FRAME_SIZE).toFixed(0) + " msg/s)"
        );
      }

      let micGatedByPlayback = false;
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const chunk = event.data;
        if (!chunk || chunk.length === 0) return;

        // STOP listening while the app's own question/answer audio is playing, so the
        // recognizer can't match keywords spoken by the TTS (the phantom-command cascade).
        if (dontListenWhenPlayerAudioPlays && (window as any).__audioPlaying) {
          micGatedByPlayback = true;
          return;
        }

        // Playback just ended: flush the recognizer so leftover/tail audio can't
        // produce a stale match the instant the mic re-opens.
        if (micGatedByPlayback) {
          micGatedByPlayback = false;
          kwsWorkerRef.current?.reset();
        }

        // 2-arg call: the client adds timestamp: Date.now() and transfers the buffer.
        kwsWorkerRef.current?.sendAudioChunk(chunk, audioCtx.sampleRate);
      };

      source.connect(workletNode);

      setEngineState("listening");
      sessionStorage.setItem("audio_listening_active", "true");
      logDebug("Voice command system fully initialized and listening.");
    } catch (err) {
      console.error("Failed to start voice command system:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      stopListeningCleanup();
    } finally {
      isStartingRef.current = false;
    }
  };

  const getCsrfToken = () => {
    const input = document.querySelector('input[name="csrf_token"]') as HTMLInputElement;
    return input ? input.value : "";
  };

  const triggerAskAiRecording = async () => {
    logDebug("Starting Ask AI recording flow...");
    wasListeningBeforeAskAiRef.current = (engineState === "listening" || sessionStorage.getItem("audio_listening_active") === "true");

    // Stop command listening while Ask AI recording is active so command recognition does not interfere.
    stopListeningCleanup();

    // Move focus/scroll to the Ask AI conversation section (rendered at the
    // bottom of the quiz page) so the user can see the recording controls.
    const askAiSection = document.getElementById("ask-ai-conversation-root");
    if (askAiSection) {
      askAiSection.scrollIntoView({ behavior: "smooth", block: "center" });
      // Make it focusable for keyboard/screen-reader users without leaving a
      // focus ring for mouse users; focus it on the next tick after scroll.
      askAiSection.setAttribute("tabindex", "-1");
      window.setTimeout(() => askAiSection.focus({ preventScroll: true }), 50);
    }

    setIsRecordingAskAi(true);
    setAskAiTranscript(null);
    setAskAiAnswer(null);
    setAskAiError(null);
    setAskAiPhase(null);
    askAiChunksRef.current = [];

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
      if (import.meta.env.DEV) console.log(`[AskAI] getUserMedia took ${(performance.now() - t_getUserMedia).toFixed(1)}ms`);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      let ondataAvailableCount = 0;
      let ondataAvailableBytes = 0;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          ondataAvailableCount += 1;
          ondataAvailableBytes += e.data.size;
          askAiChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      // Mark this ref so stopAndSendAskAi can measure stop()→onstop latency.
      (mediaRecorderRef.current as any).__askAiDataCount = () => ondataAvailableCount;
      (mediaRecorderRef.current as any).__askAiDataBytes = () => ondataAvailableBytes;
      logDebug("MediaRecorder started recording Ask AI question.");
    } catch (err) {
      console.error("Failed to start MediaRecorder for Ask AI:", err);
      setAskAiError(err instanceof Error ? err.message : String(err));
      setIsRecordingAskAi(false);
      if (wasListeningBeforeAskAiRef.current) {
        void startListening();
      }
    }
  };

  const stopAndSendAskAi = () => {
    logDebug("Stopping Ask AI recording and sending to transcribe...");
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    const t_stop = performance.now();
    (mediaRecorderRef.current as any).__askAiStopT = t_stop;

    // The recording is done as far as the user is concerned; drop the recording
    // indicator immediately and move to the transcribing phase.
    setIsRecordingAskAi(false);
    setAskAiPhase("Transcribing: Question");

    mediaRecorderRef.current.onstop = async () => {
      const t_onstop = performance.now();
      const mrAny = mediaRecorderRef.current as any;
      const stopT = mrAny?.__askAiStopT;
      const stopToOnstop = stopT ? t_onstop - stopT : NaN;
      if (import.meta.env.DEV) console.log(`[AskAI] stop()→onstop flush=${stopToOnstop.toFixed(1)}ms chunks=${mrAny?.__askAiDataCount?.() ?? "?"} bytes=${mrAny?.__askAiDataBytes?.() ?? "?"}`);

      if (mediaRecorderRef.current) {
        const stream = mediaRecorderRef.current.stream;
        stream.getTracks().forEach((track) => track.stop());
      }

      try {
        const audioBlob = new Blob(askAiChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) {
          throw new Error("Recorded audio is empty.");
        }

        logDebug(`Sending audio chunk to Flask backend. Size: ${audioBlob.size} bytes`);
        const formData = new FormData();
        formData.append("audio", audioBlob, "ask-ai-question.webm");

        const headers: Record<string, string> = {};
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
          headers["X-CSRFToken"] = csrfToken;
        }

        const abort = new AbortController();
        askAiAbortRef.current = abort;
        const t_fetchStart = performance.now();
        const response = await fetch("/api/ask-ai/transcribe", {
          method: "POST",
          headers,
          body: formData,
          signal: abort.signal,
        });
        if (import.meta.env.DEV) console.log(`[AskAI] transcribe fetch=${(performance.now() - t_fetchStart).toFixed(1)}ms (status=${response.status})`);

        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `Server responded with ${response.status}`);
        }

        if (import.meta.env.DEV) console.log(`[AskAI] transcript received (len=${(result.transcript ?? "").length}); total stop→transcript=${(performance.now() - (stopT ?? t_onstop)).toFixed(1)}ms`);
        setAskAiTranscript(result.transcript);
        // Question transcription is complete; the next phase (Thinking) will be
        // set by requestAskAiAnswer, so clear this phase here.
        setAskAiPhase(null);

        // Phase 2: send the transcript + quiz context to the LLM, then speak the answer.
        await requestAskAiAnswer(result.transcript);
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          logDebug("Ask AI transcribe request was cancelled.");
        } else {
          console.error("Failed to transcribe Ask AI audio:", err);
          setAskAiError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setAskAiPhase(null);
        mediaRecorderRef.current = null;
        askAiAbortRef.current = null;
        // Note: command listening is intentionally NOT resumed here. It is resumed
        // after the AI answer audio finishes playing (or on error/cancel) to avoid
        // the TTS output being picked up by the keyword recognizer.
      }
    };

    mediaRecorderRef.current.stop();
  };

  const resumeCommandListeningIfNeeded = () => {
    if (wasListeningBeforeAskAiRef.current) {
      void startListening();
    }
  };

  const askAiPlaybackEnded = () => {
    logDebug("Ask AI answer playback ended.");
    askAiPlaybackActiveRef.current = false;
    setAskAiAudioPlaying(false);
    // Keep askAiAudioAssets intact so the user can replay the AI response.
    resumeCommandListeningIfNeeded();
  };

  const requestAskAiAnswer = async (transcript: string) => {
    if (!question || !question.question_id) {
      setAskAiError("No active question context to ask the AI about.");
      resumeCommandListeningIfNeeded();
      return;
    }

    // Send the answer text only if the user has already revealed it on screen.
    const answerText = answerRevealed ? question.answer : "";
    const body = {
      transcript,
      question_text: question.question_text,
      question_id: question.question_id,
      answer_text: answerText,
      categories: question.categories ?? [],
      image_urls: (question.pics?.question_image ?? []).filter(Boolean) as string[],
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
      headers["X-CSRFToken"] = csrfToken;
    }

    setAskAiPhase("Thinking");
    setAskAiError(null);
    setAskAiAnswer(null);

    let answer = "";
    let language = "";
    try {
      const abort = new AbortController();
      askAiAbortRef.current = abort;
      const t_llmStart = performance.now();
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (import.meta.env.DEV) console.log(`[AskAI] LLM fetch=${(performance.now() - t_llmStart).toFixed(1)}ms (status=${response.status})`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || `Server responded with ${response.status}`);
      }

      answer = result.answer_text || "";
      language = result.language || "";
      setAskAiAnswer(answer);
      setAskAiPhase(null);

      // Step 2: synthesize the spoken answer. This is its own request so the
      // user can see the TTS latency separately from the LLM latency.
      setAskAiPhase("Transcribing: Answer");
      const speakAbort = new AbortController();
      askAiAbortRef.current = speakAbort;
      const t_speakStart = performance.now();
      const speakResponse = await fetch("/api/ask-ai/speak", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: answer, language }),
        signal: speakAbort.signal,
      });
      if (import.meta.env.DEV) console.log(`[AskAI] TTS fetch=${(performance.now() - t_speakStart).toFixed(1)}ms (status=${speakResponse.status})`);
      const speakResult = await speakResponse.json().catch(() => ({}));
      if (!speakResponse.ok || !speakResult.ok) {
        throw new Error(speakResult.error || `Server responded with ${speakResponse.status}`);
      }

      const audioB64 = speakResult.audio_b64 || null;
      const contentType = speakResult.audio_content_type || "audio/mpeg";
      if (speakResult.warning) {
        console.warn("Ask AI speak warning:", speakResult.warning);
      }
      setAskAiPhase(null);

      if (audioB64) {
        // Hand the synthesized audio to the shared AudioPlayer so the user can
        // pause/seek/etc. just like question/answer playback.
        const blob = base64ToBlob(audioB64, contentType);
        const blobUrl = URL.createObjectURL(blob);
        // Revoke any previous blob URL before replacing.
        if (askAiBlobUrlRef.current) {
          URL.revokeObjectURL(askAiBlobUrlRef.current);
        }
        askAiBlobUrlRef.current = blobUrl;
        askAiPlaybackActiveRef.current = true;
        setAskAiAudioAssets([{ url: blobUrl, lang: language || "en_US" }]);
        // Stop any other audio before starting AI playback.
        const callbacks: Array<(() => void) | undefined> = (window as any).__audioStopCallbacks;
        if (Array.isArray(callbacks)) {
          callbacks.forEach((cb) => { try { cb?.(); } catch { /* ignore */ } });
        }
        setAskAiAudioPlaying(true);
        // Listening is resumed by askAiPlaybackEnded() when playback completes
        // (see AudioPlayer onSequenceEnd), NOT here.
      }
    } catch (err) {
      if ((err as any)?.name === "AbortError") {
        logDebug("Ask AI request was cancelled.");
      } else {
        console.error("Ask AI answer request failed:", err);
        setAskAiError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      askAiAbortRef.current = null;
      setAskAiPhase(null);
      // Only resume listening here if we did NOT hand off to the audio player.
      // When playback is active, listening is resumed in askAiPlaybackEnded().
      if (!askAiPlaybackActiveRef.current) {
        resumeCommandListeningIfNeeded();
      }
    }
  };

  const cancelAskAi = () => {
    logDebug("Cancelling Ask AI (any phase)...");

    // Abort any in-flight transcription/LLM/TTS network requests.
    if (askAiAbortRef.current) {
      try { askAiAbortRef.current.abort(); } catch { /* ignore */ }
      askAiAbortRef.current = null;
    }

    // Stop the recorder if it's still running.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach((track) => track.stop());
        }
        mediaRecorderRef.current = null;
      };
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    } else if (mediaRecorderRef.current) {
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    // Stop answer playback if it's running.
    askAiPlaybackActiveRef.current = false;
    setAskAiAudioPlaying(false);
    setAskAiAudioAssets([]);
    if (askAiBlobUrlRef.current) {
      URL.revokeObjectURL(askAiBlobUrlRef.current);
      askAiBlobUrlRef.current = null;
    }
    // Clear the manual mic gate if it was set during playback.
    (window as any).__audioPlaying = false;

    setIsRecordingAskAi(false);
    setAskAiPhase(null);
    if (wasListeningBeforeAskAiRef.current) {
      void startListening();
    }
  };

  useEffect(() => {
    (window as any).audioAskAi = () => {
      void triggerAskAiRecording();
    };
    return () => {
      delete (window as any).audioAskAi;
    };
  }, [engineState]);

  // The Ask AI conversation panel is rendered at the bottom of the quiz page
  // (into #ask-ai-conversation-root) via a portal when that container exists.
  // When it doesn't (e.g. the standalone command-system entry), fall back to
  // rendering inline inside the command system container.
  const [askAiPortalTarget, setAskAiPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const resolve = () => setAskAiPortalTarget(document.getElementById("ask-ai-conversation-root"));
    resolve();
    // The container is rendered by a sibling component, so re-check shortly after
    // mount in case it wasn't in the DOM on the first pass.
    const timer = window.setTimeout(resolve, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const askAiConversation = (
    <>
      {isRecordingAskAi && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={styles.askAiPulse}></span>
            <span>Recording Ask AI question...</span>
          </div>
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnStop)}
              onClick={stopAndSendAskAi}
              disabled={!!askAiPhase}
            >
              Stop & Send
            </button>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={cancelAskAi}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {askAiPhase && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={cx(styles.spinnerBorder, styles.spinnerInline)} role="status" aria-hidden="true"></span>
            <span>{askAiPhase}...</span>
          </div>
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={cancelAskAi}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {askAiError && (
        <div className={styles.errorMessage}>
          Ask AI Error: {askAiError}
        </div>
      )}

      {askAiTranscript && (
        <div className={styles.askAiTranscriptBox}>
          <div className={styles.askAiTranscriptTitle}>Ask AI Transcript:</div>
          <div className={styles.askAiTranscriptText}>{askAiTranscript}</div>
        </div>
      )}

      {askAiAnswer && (
        <div className={styles.askAiAnswerBox}>
          <div className={styles.askAiTranscriptTitle}>AI Tutor Answer:</div>
          <div className={styles.askAiAnswerText}>
            <MarkdownContent content={askAiAnswer} />
          </div>
        </div>
      )}

      {askAiAudioAssets.length > 0 && (
        <div className={styles.askAiAnswerPlayer}>
          <LargePlayableControl
            onClick={() => setAskAiAudioPlaying((prev) => !prev)}
            isPlaying={askAiAudioPlaying}
            className={styles.askAiAnswerPlayerBox}
            assets={askAiAudioAssets}
            onSequenceEnd={askAiPlaybackEnded}
          />
          <div className={styles.askAiActions}>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={cancelAskAi}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={styles.voiceCommandContainer}>
      <div className={styles.controlsRow}>
        <div className={styles.splitButtonContainer}>
          <button
            type="button"
            onClick={startListening}
            disabled={engineState === "loading"}
            className={cx(
              actionStyles.largeBtn,
              styles.mainSplitBtn,
              engineState === "listening" && cx(actionStyles.redBtn, styles.pulseListening),
              engineState === "loading" && actionStyles.orangeBtn,
              engineState === "idle" && actionStyles.greenBtn
            )}
          >
            {engineState === "listening" ? (
              <div className={styles.btnContentCol}>
                <div className={actionStyles.btnContent}>
                  <span className={styles.spinnerGrow} role="status" aria-hidden="true"></span>
                  <span>Listening for commands...</span>
                </div>
                {lastCommand && (
                  <div className={styles.detectedInside}>
                    Detected: <span className={styles.commandBadgeInside}>{lastCommand}</span>
                  </div>
                )}
              </div>
            ) : engineState === "loading" ? (
              <div className={actionStyles.btnContent}>
                <span className={styles.spinnerBorder} role="status" aria-hidden="true"></span>
                <span>Initializing...</span>
              </div>
            ) : (
              <div className={actionStyles.btnContent}>
                <span className={styles.micIcon}>🎤</span>
                <span>Listen</span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className={cx(
              actionStyles.largeBtn,
              styles.menuSplitBtn,
              engineState === "listening" && actionStyles.redBtn,
              engineState === "loading" && actionStyles.orangeBtn,
              engineState === "idle" && actionStyles.greenBtn
            )}
            title="Available commands"
          >
            ☰
          </button>

          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownHeader}>Available Commands</div>
              {AVAILABLE_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    runCommand(cmd);
                  }}
                >
                  {cmd}
                </button>
              ))}
            </div>
          )}
        </div>

        {engineState === "listening" && (
          <button
            type="button"
            className={styles.stopButton}
            onClick={() => stopListening(true)}
            title="Stop listening"
          >
            ⏹
          </button>
        )}
      </div>

      {errorMsg && (
        <div className={styles.errorMessage}>
          ⚠️ {errorMsg}
        </div>
      )}

      {askAiPortalTarget
        ? createPortal(askAiConversation, askAiPortalTarget)
        : askAiConversation}
    </div>
  );
}