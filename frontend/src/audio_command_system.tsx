import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

interface SherpaStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  inputFinished(): void;
  free(): void;
}

interface SherpaKws {
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  reset(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { keyword?: string };
  free(): void;
}

type EngineState = "idle" | "loading" | "listening" | "error";
type CommandCallback = () => void;

declare global {
  interface Window {
    Module?: any;
    createKws?: (module: any, config?: any) => SherpaKws;
    audioReadQuestion?: () => void;
  }
}

const KWS_BASE_URL = "/static/models/kws";
const TARGET_SAMPLE_RATE = 16000;

// AudioWorklet code as a string — it runs in a separate thread, so we can't
// import it from this file directly. We blob-url it at runtime.
const PCM_WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // Copy because the underlying buffer is reused by the audio thread.
      this.port.postMessage(input[0].slice(0));
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

function buildWorkletBlobUrl(): string {
  const blob = new Blob([PCM_WORKLET_SOURCE], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

async function buildKwsConfig(): Promise<any> {
  const res = await fetch(`${KWS_BASE_URL}/keywords.txt`);
  if (!res.ok) {
    throw new Error(`Failed to fetch keywords.txt: ${res.status} ${res.statusText}`);
  }
  const keywordsText = await res.text();

  return {
    featConfig: {
      samplingRate: TARGET_SAMPLE_RATE,
      featureDim: 80,
    },
    modelConfig: {
      transducer: {
        encoder: "./encoder-epoch-12-avg-2-chunk-16-left-64.onnx",
        decoder: "./decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
        joiner: "./joiner-epoch-12-avg-2-chunk-16-left-64.onnx",
      },
      tokens: "./tokens.txt",
      provider: "cpu",
      modelType: "",
      numThreads: 1,
      num_threads: 1,
      debug: 0,
      modelingUnit: "bpe",
      modeling_unit: "bpe",
      bpeVocab: "./bpe.model",
      bpe_vocab: "./bpe.model",
    },
    maxActivePaths: 4,
    numTrailingBlanks: 1,
    keywordsScore: 1.5,
    keywordsThreshold: 0.35,
    keywords: keywordsText, // raw content, not a path
  };
}

class AudioCommandManager {
  private callbacks = new Map<string, CommandCallback>();

  registerCommand(command: string, callback: CommandCallback) {
    this.callbacks.set(this.normalize(command), callback);
  }

  triggerCommand(command: string) {
    const normalized = this.normalize(command);
    const callback = this.callbacks.get(normalized);
    if (!callback) {
      console.warn(`[AudioCommandManager] No callback registered for "${normalized}"`);
      return;
    }
    console.log(`[AudioCommandManager] Triggered "${normalized}"`);
    callback();
  }

  private normalize(command: string) {
    return command.toUpperCase().trim();
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    if (!existing) {
      document.body.appendChild(script);
    }
  });
}

function resampleLinear(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return new Float32Array(input);

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIndex - i0;
    output[i] = input[i0] + (input[i1] - input[i0]) * frac;
  }
  return output;
}

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

    manager.registerCommand("READ QUESTION", () => {
      console.log(`Executing "READ QUESTION"`);
      if (typeof window.audioReadQuestion === "function") {
        window.audioReadQuestion();
      } else {
        console.error("window.audioReadQuestion was not found.");
      }
    });
    manager.registerCommand("CORRECT", () => console.log("Voice Command: CORRECT"));
    manager.registerCommand("WRONG", () => console.log("Voice Command: WRONG"));
    manager.registerCommand("GET ANSWER", () => console.log("Voice Command: GET ANSWER"));
    manager.registerCommand("RELOAD", () => console.log("Voice Command: RELOAD"));
    manager.registerCommand("ASK AI", () => console.log("Voice Command: ASK AI"));

    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopListening = () => {
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
  };

  const initializeSherpa = async () => {
    if (window.createKws && window.Module?.calledRun) return;

    if (!window.crossOriginIsolated) {
      throw new Error(
        "Cross-Origin Isolation is not enabled (window.crossOriginIsolated is false). " +
        "Sherpa-ONNX WASM KWS requires COOP and COEP headers, and must be accessed via localhost or HTTPS."
      );
    }

    console.log("Initializing Sherpa-ONNX KWS WASM...");
    const debugLogs: string[] = [];

    const wasmReady = new Promise<void>((resolve) => {
      window.Module = {
        print: (text: string) => {
          const line = `[Sherpa-WASM STDOUT] ${text}`;
          console.log(line);
          debugLogs.push(line);
        },
        printErr: (text: string) => {
          const line = `[Sherpa-WASM] ${text}`;
          // Sherpa writes both info logs and real errors to stderr.
          // Only flag lines that look like genuine failures.
          const looksLikeError = /\b(error|fail|failed|fatal|exception|abort|cannot|invalid)\b/i.test(text);
          if (looksLikeError) {
            console.error(line);
          } else {
            console.debug(line);
          }
          debugLogs.push(line);
        },
        locateFile: (path: string) => `${KWS_BASE_URL}/${path}`,
        onRuntimeInitialized: () => {
          console.log("Sherpa WASM runtime initialized.");
          resolve();
        },
      };
    });

    try {
      await loadScript(`${KWS_BASE_URL}/sherpa-onnx-kws.js`);
      await loadScript(`${KWS_BASE_URL}/sherpa-onnx-wasm-kws-main.js`);
      await wasmReady;
    } catch (err) {
      const tail = debugLogs.slice(-5).join("\n");
      throw new Error(`Failed to initialize Sherpa WASM. ${String(err)}\n${tail}`);
    }

    if (typeof window.createKws !== "function") {
      throw new Error("Sherpa createKws() was not found after loading sherpa-onnx-kws.js.");
    }
  };

  const startListening = async () => {
    if (isStartingRef.current || engineState === "loading") return;
    if (engineState === "listening") {
      stopListening();
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
        commandManagerRef.current.triggerCommand(keyword);
        recognizer.reset(recognizerStream);
      };

      // Worklet has no output; we don't connect it to destination.
      source.connect(workletNode);

      setEngineState("listening");
      console.log("Voice command system started.");
    } catch (err) {
      console.error("Failed to start voice command system:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      stopListening();
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
                : "btn-outline-success"
          } d-flex align-items-center gap-2 px-4 py-2 font-weight-bold shadow-sm`}
          style={{ borderRadius: "24px", transition: "all 0.3s ease" }}
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
            onClick={stopListening}
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

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("audio-command-root");
  if (!container) return;
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <AudioCommandSystemComponent />
    </React.StrictMode>
  );
});
