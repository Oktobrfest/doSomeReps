import { useEffect, useRef, useState } from "react";
import { EngineState, SherpaKws, SherpaStream } from "./types";
import { AudioCommandManager } from "./AudioCommandManager";
import { buildKwsConfig, initializeSherpa, TARGET_SAMPLE_RATE } from "./sherpaEngine";
import { buildWorkletBlobUrl, resampleLinear } from "./audioCapture";
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

function normalizeDetectedKeyword(keyword: string): string {
  return keyword.toUpperCase().trim();
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AudioCommandSystemComponent() {
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Clear detected command display after 6 seconds
  useEffect(() => {
    if (!lastCommand) return;

    const timer = setTimeout(() => {
      setLastCommand(null);
    }, 6000);

    return () => clearTimeout(timer);
  }, [lastCommand]);

  const commandManagerRef = useRef(new AudioCommandManager());
  const recognizerRef = useRef<SherpaKws | null>(null);
  const recognizerStreamRef = useRef<SherpaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workletUrlRef = useRef<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

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
      stopListening(false);
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
    const handleOutsideClick = () => {
      setMenuOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [menuOpen]);

  const stopListening = (manual = false) => {
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
      if (recognizerStreamRef.current) {
        recognizerStreamRef.current.free();
        recognizerStreamRef.current = null;
      }
      if (recognizerRef.current) {
        recognizerRef.current.free();
        recognizerRef.current = null;
      }
    } catch (err) {
      console.warn("Error during stopListening cleanup:", err);
    }
    isStartingRef.current = false;
    setEngineState("idle");
    if (manual) {
      sessionStorage.setItem("audio_listening_active", "false");
    }
  };

  const stopListeningRef = useRef(stopListening);
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  useEffect(() => {
    (window as any).stopAudioListening = () => {
      stopListeningRef.current(true);
    };
    return () => {
      delete (window as any).stopAudioListening;
    };
  }, []);

  const startListening = async () => {
    if (isStartingRef.current || engineState === "loading") return;
    if (engineState === "listening") {
      stopListening(true);
      return;
    }

    isStartingRef.current = true;
    setEngineState("loading");
    setErrorMsg(null);
    setLastCommand(null);

    try {
      await initializeSherpa();

      console.log("Loading keyword spotter config...");
      const config = await buildKwsConfig();

      console.log("Creating Sherpa keyword spotter...");
      const recognizer = window.createKws!(window.Module, config);
      recognizerRef.current = recognizer;

      const recognizerStream = recognizer.createStream();
      recognizerStreamRef.current = recognizerStream;

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
      const audioCtx: AudioContext = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const inputSampleRate = audioCtx.sampleRate;
      console.log(`AudioContext sample rate: ${inputSampleRate}`);

      // Register the worklet from a blob URL so we don't need a separate file.
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

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const chunk = event.data;
        if (!chunk || chunk.length === 0) return;

        const samples = resampleLinear(chunk, inputSampleRate, TARGET_SAMPLE_RATE);
        recognizerStream.acceptWaveform(TARGET_SAMPLE_RATE, samples);

        while (recognizer.isReady(recognizerStream)) {
          recognizer.decode(recognizerStream);
        }

        const result = recognizer.getResult(recognizerStream);
        const keyword = result?.keyword ? normalizeDetectedKeyword(result.keyword) : "";
        if (!keyword) return;

        console.log(`[KWS] Match detected: "${keyword}"`);
        setLastCommand(keyword);

        // For commands that navigate/submit the page, stop listening cleanly first.
        // We do NOT treat this as manual stop, so sessionStorage.audio_listening_active stays "true" for the next page.
        if (keyword === "CORRECT" || keyword === "WRONG") {
          stopListening(false);
        }

        commandManagerRef.current.triggerCommand(keyword);
        recognizer.reset(recognizerStream);
      };

      // Worklet has no output; we don't connect it to destination.
      source.connect(workletNode);

      setEngineState("listening");
      sessionStorage.setItem("audio_listening_active", "true");
      console.log("Voice command system started.");
    } catch (err) {
      console.error("Failed to start voice command system:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      stopListening(true);
      setEngineState("error");
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
