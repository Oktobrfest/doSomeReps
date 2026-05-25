import { useEffect, useRef, useState } from "react";
import { EngineState, SherpaKws, SherpaStream } from "./types";
import { AudioCommandManager } from "./AudioCommandManager";
import { buildKwsConfig, initializeSherpa, TARGET_SAMPLE_RATE } from "./sherpaEngine";
import { buildWorkletBlobUrl, resampleLinear } from "./audioCapture";
import { registerAllCommands } from "./commands";

function normalizeDetectedKeyword(keyword: string): string {
  return keyword.toUpperCase().trim();
}

export function AudioCommandSystemComponent() {
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

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
    <div className="audio-voice-command-container mb-3 text-center">
      <div className="d-flex align-items-center justify-content-center gap-2">
        <button
          type="button"
          onClick={startListening}
          disabled={engineState === "loading"}
          className={`btn ${
            engineState === "listening"
              ? "btn-danger pulse-listening"
              : engineState === "loading"
                ? "btn-warning"
                : "btn-success"
          } d-flex align-items-center gap-2 font-weight-bold shadow-sm`}
          style={{ transition: "all 0.3s ease" }}
        >
          {engineState === "listening" ? (
            <>
              <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
              Listening for commands...
            </>
          ) : engineState === "loading" ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              Initializing...
            </>
          ) : (
            <>
              <span>🎤</span> Listen
            </>
          )}
        </button>

        {engineState === "listening" && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => stopListening(true)}
            style={{ borderRadius: "50%", width: "40px", height: "40px", padding: "0" }}
            title="Stop listening"
          >
            ⏹
          </button>
        )}
      </div>

      {lastCommand && (
        <div className="mt-2 text-success small font-weight-bold">
          Detected: <span className="badge badge-success px-2 py-1">{lastCommand}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-2 text-danger small font-weight-bold" style={{ whiteSpace: "pre-wrap" }}>
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
}
