import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { AudioCommandManager } from "./AudioCommandManager";
import { buildWorkletBlobUrl } from "./audioCapture";
import { KwsWorkerClient } from "./kwsWorkerClient";
import type { WorkerState } from "./kwsWorkerClient";
import { registerAllCommands } from "./commands";
import styles from "./AudioCommandSystem.module.css";
import actionStyles from "./ActionButton.module.css";
import { MarkdownContent } from "../components/MarkdownContent";
import type { Question } from "./types";
import {
  logMediaStreamDiagnostics,
  logAudioContextDiagnostics,
  logAudioDiagnostic,
  probeAudioContextSampleRateSupport,
} from "./audioDiagnostics";

interface AudioCommandSystemComponentProps {
  question?: Question | null;
  answerRevealed?: boolean;
}

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

// AudioWorklet batching: samples accumulated before posting one frame.
// 1280 @48k ≈ 26.7ms ≈ ~37 msgs/sec (vs ~375/sec at the 128-sample default).
// Tune: 512 (lower latency, more msgs) / 1024 / 2048 (less overhead, more latency).
// Does NOT change sample rate or resampling.
const PCM_WORKLET_FRAME_SIZE = 1280;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AudioCommandSystemComponent({
  question,
  answerRevealed,
}: AudioCommandSystemComponentProps) {
  const [engineState, setEngineState] = useState<WorkerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Ask AI state
  const [isRecordingAskAi, setIsRecordingAskAi] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [askAiTranscript, setAskAiTranscript] = useState<string | null>(null);
  const [askAiAnswer, setAskAiAnswer] = useState<string | null>(null);
  const [askAiError, setAskAiError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const askAiChunksRef = useRef<Blob[]>([]);
  const wasListeningBeforeAskAiRef = useRef(false);
  const askAiAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Build a stable callback-based interface for the KWS worker
  const handleKeyword = useCallback((keyword: string) => {
    logDebug(`Keyword matched in worker: "${keyword}"`);
    setLastCommand(keyword);
    commandManagerRef.current.triggerCommand(keyword);

    // For commands that navigate/submit, stop listening cleanly
    if (keyword === "CORRECT" || keyword === "WRONG") {
      logDebug(`Command "${keyword}" requires stopping the active audio listener.`);
      stopListeningCleanup();
    }
    // Reset the worker's keyword state after detection to avoid repeats
    kwsWorkerRef.current?.reset();
  }, []);

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
        if ((window as any).__audioPlaying) {
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

    setIsRecordingAskAi(true);
    setAskAiTranscript(null);
    setAskAiAnswer(null);
    setAskAiError(null);
    setIsThinking(false);
    setIsGeneratingAudio(false);
    askAiChunksRef.current = [];

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
        if (e.data && e.data.size > 0) {
          askAiChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
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

    setIsTranscribing(true);

    mediaRecorderRef.current.onstop = async () => {
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

        const response = await fetch("/api/ask-ai/transcribe", {
          method: "POST",
          headers,
          body: formData,
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `Server responded with ${response.status}`);
        }

        console.log("Ask AI Transcript Result:", result.transcript);
        setAskAiTranscript(result.transcript);
        setIsRecordingAskAi(false);

        // Phase 2: send the transcript + quiz context to the LLM, then speak the answer.
        await requestAskAiAnswer(result.transcript);
      } catch (err) {
        console.error("Failed to transcribe Ask AI audio:", err);
        setAskAiError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsTranscribing(false);
        mediaRecorderRef.current = null;
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

  const playAskAiAnswer = (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!askAiAudioRef.current) {
        resolve();
        return;
      }
      const audio = askAiAudioRef.current;
      audio.src = audioUrl;

      // Gate the mic while our own TTS audio plays so the keyword recognizer
      // cannot match words spoken by the answer (echo/feedback protection).
      (window as any).__audioPlaying = true;

      const cleanup = () => {
        (window as any).__audioPlaying = false;
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        resolve();
      };
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      void audio.play().catch((err) => {
        console.error("Ask AI answer playback failed:", err);
        cleanup();
        resolve();
      });
    });
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

    setIsThinking(true);
    setAskAiError(null);
    setAskAiAnswer(null);

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || `Server responded with ${response.status}`);
      }

      const answer = result.answer_text || "";
      const audioUrl = result.audio_url || null;
      setAskAiAnswer(answer);
      setIsThinking(false);

      if (audioUrl) {
        setIsGeneratingAudio(true);
        await playAskAiAnswer(audioUrl);
        setIsGeneratingAudio(false);
      }
    } catch (err) {
      console.error("Ask AI answer request failed:", err);
      setAskAiError(err instanceof Error ? err.message : String(err));
      setIsGeneratingAudio(false);
    } finally {
      setIsThinking(false);
      resumeCommandListeningIfNeeded();
    }
  };

  const cancelAskAiRecording = () => {
    logDebug("Cancelling Ask AI recording...");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach((track) => track.stop());
        }
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current.stop();
    } else if (mediaRecorderRef.current) {
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    setIsRecordingAskAi(false);
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
              disabled={isTranscribing}
            >
              Stop & Send
            </button>
            <button
              type="button"
              className={cx(actionStyles.largeBtn, styles.askAiBtnCancel)}
              onClick={cancelAskAiRecording}
              disabled={isTranscribing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isTranscribing && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={styles.spinnerBorder} role="status" aria-hidden="true" style={{ width: '1.2rem', height: '1.2rem' }}></span>
            <span>Transcribing...</span>
          </div>
        </div>
      )}

      {isThinking && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={styles.spinnerBorder} role="status" aria-hidden="true" style={{ width: '1.2rem', height: '1.2rem' }}></span>
            <span>Thinking...</span>
          </div>
        </div>
      )}

      {isGeneratingAudio && (
        <div className={styles.askAiContainer}>
          <div className={styles.askAiTitle}>
            <span className={styles.spinnerBorder} role="status" aria-hidden="true" style={{ width: '1.2rem', height: '1.2rem' }}></span>
            <span>Generating audio...</span>
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

      {/* Hidden audio element used to play Piper-generated Ask AI answers. */}
      <audio ref={askAiAudioRef} preload="none" />
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
                    commandManagerRef.current.triggerCommand(cmd);
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
