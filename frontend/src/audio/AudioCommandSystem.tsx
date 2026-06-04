import { useEffect, useRef, useState, useCallback } from "react";
import { AudioCommandManager } from "./AudioCommandManager";
import { buildWorkletBlobUrl } from "./audioCapture";
import { KwsWorkerClient } from "./kwsWorkerClient";
import type { WorkerState } from "./kwsWorkerClient";
import { registerAllCommands } from "./commands";
import styles from "./AudioCommandSystem.module.css";
import actionStyles from "./ActionButton.module.css";

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AudioCommandSystemComponent() {
  const [engineState, setEngineState] = useState<WorkerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Clear detected command display after 6 seconds
  useEffect(() => {
    if (!lastCommand) return;
    const timer = setTimeout(() => setLastCommand(null), 6000);
    return () => clearTimeout(timer);
  }, [lastCommand]);

  // Build a stable callback-based interface for the KWS worker
  const handleKeyword = useCallback((keyword: string) => {
    setLastCommand(keyword);
    commandManagerRef.current.triggerCommand(keyword);

    // For commands that navigate/submit, stop listening cleanly
    if (keyword === "CORRECT" || keyword === "WRONG") {
      stopListeningCleanup();
    }
    // Reset the worker's keyword state after detection to avoid repeats
    kwsWorkerRef.current?.reset();
  }, []);

  // Register commands once.
  useEffect(() => {
    const manager = commandManagerRef.current;
    registerAllCommands(manager);

    const exitBtn = document.getElementById("exit-audio-mode");
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        sessionStorage.setItem("audio_listening_active", "false");
      });
    }

    return () => {
      stopListeningCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start listening if previously active
  useEffect(() => {
    const wasListening = sessionStorage.getItem("audio_listening_active") === "true";
    if (wasListening) {
      const timer = setTimeout(() => {
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
    try {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (workletUrlRef.current) {
        URL.revokeObjectURL(workletUrlRef.current);
        workletUrlRef.current = null;
      }
    } catch (err) {
      console.warn("Error during audio capture cleanup:", err);
    }
  };

  // ---- Full stop: worker + audio capture ----

  const stopListeningCleanup = () => {
    stopAudioCapture();
    if (kwsWorkerRef.current) {
      kwsWorkerRef.current.stop();
      kwsWorkerRef.current = null;
    }
    isStartingRef.current = false;
    setEngineState("idle");
  };

  const stopListening = (manual = false) => {
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
    if (isStartingRef.current || engineState === "loading") return;
    if (engineState === "listening" || engineState === "ready") {
      stopListening(true);
      return;
    }

    isStartingRef.current = true;
    setEngineState("loading");
    setErrorMsg(null);
    setLastCommand(null);

    try {
      // 1. Start the KWS Web Worker (handles all WASM/model loading off main thread)
      const kwsWorker = new KwsWorkerClient({
        onKeyword: handleKeyword,
        onReady: () => {
          // Worker is initialized but we still need audio capture
          // State will be set to "listening" after audio capture starts
        },
        onError: (msg) => {
          setErrorMsg(msg);
          stopListeningCleanup();
        },
        onStateChange: (state) => {
          // Don't override "listening" with "ready" — audio capture is the final step
          if (state === "ready") return;
          setEngineState(state);
        },
      });

      kwsWorkerRef.current = kwsWorker;
      await kwsWorker.start();

      // 2. Start microphone capture
      console.log("Requesting microphone permission...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = mediaStream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      inputSampleRateRef.current = audioCtx.sampleRate;
      console.log(`AudioContext sample rate: ${audioCtx.sampleRate}`);

      // Register the PCM capture worklet
      const workletUrl = buildWorkletBlobUrl();
      workletUrlRef.current = workletUrl;
      await audioCtx.audioWorklet.addModule(workletUrl);

      const source = audioCtx.createMediaStreamSource(mediaStream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, "pcm-capture-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      workletNodeRef.current = workletNode;

      // Route PCM chunks from the worklet to the KWS worker
      // The worklet runs on the audio thread, but onmessage fires on main thread.
      // We immediately forward to the worker (which transfers the buffer, avoiding copy).
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const chunk = event.data;
        if (!chunk || chunk.length === 0) return;
        kwsWorkerRef.current?.sendAudioChunk(chunk);
      };

      source.connect(workletNode);

      setEngineState("listening");
      sessionStorage.setItem("audio_listening_active", "true");
      console.log("Voice command system started (KWS in Web Worker).");
    } catch (err) {
      console.error("Failed to start voice command system:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      stopListeningCleanup();
    } finally {
      isStartingRef.current = false;
    }
  };

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
                <div key={cmd} className={styles.dropdownItem}>
                  {cmd}
                </div>
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
    </div>
  );
}
