import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

// Define TypeScript interfaces for the Sherpa-ONNX WebAssembly wrapper
interface SherpaStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  inputFinished(): void;
  free(): void;
}

interface SherpaKws {
  handle: number;
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  reset(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { keyword: string };
  free(): void;
}

type CommandCallback = () => void;

class AudioCommandManager {
  private callbacks: Map<string, CommandCallback> = new Map();

  registerCommand(command: string, callback: CommandCallback) {
    this.callbacks.set(command.toUpperCase().trim(), callback);
  }

  triggerCommand(command: string) {
    const cmd = command.toUpperCase().trim();
    const callback = this.callbacks.get(cmd);
    if (callback) {
      console.log(`[AudioCommandManager] Triggered callback for: "${cmd}"`);
      callback();
    } else {
      console.warn(`[AudioCommandManager] No callback registered for command: "${cmd}"`);
    }
  }
}

// Customized exact-offset struct allocation for OnlineModelConfig in newer C++ builds
function initModelConfigCustom(config: any, Module: any) {
  const encoderLen = Module.lengthBytesUTF8(config.transducer.encoder) + 1;
  const decoderLen = Module.lengthBytesUTF8(config.transducer.decoder) + 1;
  const joinerLen = Module.lengthBytesUTF8(config.transducer.joiner) + 1;
  
  const transducerBuffer = Module._malloc(encoderLen + decoderLen + joinerLen);
  const transducerPtr = Module._malloc(12);
  
  let offset = 0;
  Module.stringToUTF8(config.transducer.encoder, transducerBuffer + offset, encoderLen);
  offset += encoderLen;
  Module.stringToUTF8(config.transducer.decoder, transducerBuffer + offset, decoderLen);
  offset += decoderLen;
  Module.stringToUTF8(config.transducer.joiner, transducerBuffer + offset, joinerLen);
  
  Module.setValue(transducerPtr, transducerBuffer, "i8*");
  Module.setValue(transducerPtr + 4, transducerBuffer + encoderLen, "i8*");
  Module.setValue(transducerPtr + 8, transducerBuffer + encoderLen + decoderLen, "i8*");

  // Allocate OnlineModelConfig (incorporating new C++ 'warm_up' parameter!)
  const modelConfigLen = 12 + 8 + 4 + 4 + 4 + 4 + (10 * 4);
  const ptr = Module._malloc(modelConfigLen);
  Module.HEAPU8.fill(0, ptr, ptr + modelConfigLen);
  
  Module._CopyHeap(transducerPtr, 12, ptr);
  Module._free(transducerPtr);

  const tokensLen = Module.lengthBytesUTF8(config.tokens) + 1;
  const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
  const modelTypeLen = Module.lengthBytesUTF8(config.modelType || "") + 1;
  const modelingUnitLen = Module.lengthBytesUTF8(config.modelingUnit || "bpe") + 1;
  const bpeVocabLen = Module.lengthBytesUTF8(config.bpeVocab || "") + 1;
  
  const bufferLen = tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen;
  const buffer = Module._malloc(bufferLen);
  
  let sOffset = 0;
  Module.stringToUTF8(config.tokens, buffer, tokensLen);
  sOffset += tokensLen;
  Module.stringToUTF8(config.provider || "cpu", buffer + sOffset, providerLen);
  sOffset += providerLen;
  Module.stringToUTF8(config.modelType || "", buffer + sOffset, modelTypeLen);
  sOffset += modelTypeLen;
  Module.stringToUTF8(config.modelingUnit || "bpe", buffer + sOffset, modelingUnitLen);
  sOffset += modelingUnitLen;
  Module.stringToUTF8(config.bpeVocab || "", buffer + sOffset, bpeVocabLen);

  // Set memory values at exact offsets expected by C++
  Module.setValue(ptr + 32, buffer, "i8*"); // tokens
  Module.setValue(ptr + 36, config.numThreads || 1, "i32"); // num_threads
  Module.setValue(ptr + 40, config.warmUp || 0, "i32"); // warm_up
  Module.setValue(ptr + 44, buffer + tokensLen, "i8*"); // provider
  Module.setValue(ptr + 48, config.debug ? 1 : 0, "i32"); // debug
  Module.setValue(ptr + 52, buffer + tokensLen + providerLen, "i8*"); // model_type
  Module.setValue(ptr + 56, buffer + tokensLen + providerLen + modelTypeLen, "i8*"); // modeling_unit
  Module.setValue(ptr + 60, buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen, "i8*"); // bpe_vocab

  return {
    buffer: buffer,
    ptr: ptr,
    len: modelConfigLen,
    transducerBuffer: transducerBuffer
  };
}

// Custom spotter configuration builder with exact offsets
function initKwsConfigCustom(config: any, Module: any) {
  const featConfigPtr = Module._malloc(8);
  Module.setValue(featConfigPtr, config.featConfig.samplingRate || 16000, "i32");
  Module.setValue(featConfigPtr + 4, config.featConfig.featureDim || 80, "i32");

  const modelConfig = initModelConfigCustom(config.modelConfig, Module);
  
  const numBytes = 8 + modelConfig.len + (4 * 7);
  const ptr = Module._malloc(numBytes);
  Module.HEAPU8.fill(0, ptr, ptr + numBytes);
  
  let offset = 0;
  Module._CopyHeap(featConfigPtr, 8, ptr + offset);
  offset += 8;
  
  Module._CopyHeap(modelConfig.ptr, modelConfig.len, ptr + offset);
  offset += modelConfig.len;
  
  Module.setValue(ptr + offset, config.maxActivePaths || 4, "i32");
  offset += 4;
  Module.setValue(ptr + offset, config.numTrailingBlanks || 1, "i32");
  offset += 4;
  Module.setValue(ptr + offset, config.keywordsScore || 1.0, "float");
  offset += 4;
  Module.setValue(ptr + offset, config.keywordsThreshold || 0.25, "float");
  offset += 4;
  
  const keywordsLen = Module.lengthBytesUTF8(config.keywords) + 1;
  const keywordsBuffer = Module._malloc(keywordsLen);
  Module.stringToUTF8(config.keywords, keywordsBuffer, keywordsLen);
  
  Module.setValue(ptr + offset, keywordsBuffer, "i8*");
  offset += 4;
  Module.setValue(ptr + offset, 0, "i8*"); // keywordsBuf
  offset += 4;
  Module.setValue(ptr + offset, 0, "i32"); // keywordsBufSize
  
  Module._free(featConfigPtr);
  
  return {
    ptr: ptr,
    modelConfig: modelConfig,
    keywordsBuffer: keywordsBuffer
  };
}

function freeKwsConfigCustom(config: any, Module: any) {
  if (config.keywordsBuffer) {
    Module._free(config.keywordsBuffer);
  }
  if (config.modelConfig) {
    if (config.modelConfig.buffer) {
      Module._free(config.modelConfig.buffer);
    }
    if (config.modelConfig.transducerBuffer) {
      Module._free(config.modelConfig.transducerBuffer);
    }
    if (config.modelConfig.ptr) {
      Module._free(config.modelConfig.ptr);
    }
  }
  if (config.ptr) {
    Module._free(config.ptr);
  }
}

export function AudioCommandSystemComponent() {
  const [engineState, setEngineState] = useState<"idle" | "loading" | "listening" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const commandManagerRef = useRef<AudioCommandManager>(new AudioCommandManager());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderNodeRef = useRef<ScriptProcessorNode | null>(null);
  const recognizerRef = useRef<SherpaKws | null>(null);
  const streamRef = useRef<SherpaStream | null>(null);

  // Initialize and register callbacks
  useEffect(() => {
    const manager = commandManagerRef.current;

    // Register our primary wired command
    manager.registerCommand("READ QUESTION", () => {
      console.log("Executing 'READ QUESTION' command...");
      if (typeof (window as any).audioReadQuestion === "function") {
        (window as any).audioReadQuestion();
      } else {
        console.error("audioReadQuestion function not found in global scope!");
      }
    });

    // Architecture support for remaining commands (not wired up to act, but registered)
    manager.registerCommand("CORRECT", () => console.log("Voice Command: CORRECT"));
    manager.registerCommand("WRONG", () => console.log("Voice Command: WRONG"));
    manager.registerCommand("GET ANSWER", () => console.log("Voice Command: GET ANSWER"));
    manager.registerCommand("RELOAD", () => console.log("Voice Command: RELOAD"));
    manager.registerCommand("ASK AI", () => console.log("Voice Command: ASK AI"));
  }, []);

  const stopListening = () => {
    if (recorderNodeRef.current) {
      try {
        recorderNodeRef.current.disconnect();
      } catch (e) {}
      recorderNodeRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      try {
        mediaStreamSourceRef.current.disconnect();
      } catch (e) {}
      mediaStreamSourceRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.free();
      } catch (e) {}
      streamRef.current = null;
    }
    setEngineState("idle");
  };

  const startVoiceEngine = async () => {
    if (engineState === "listening") {
      stopListening();
      return;
    }

    setEngineState("loading");
    setErrorMsg(null);

    // Track standard output and error output from WebAssembly C++ engine
    const debugLogs: string[] = [];

    try {
      // 1. Fetch assets in parallel from static/models/kws/
      const fileUrls = {
        encoder: "/static/models/kws/encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        decoder: "/static/models/kws/decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        joiner: "/static/models/kws/joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        tokens: "/static/models/kws/tokens.txt",
        bpe: "/static/models/kws/bpe.model",
        keywords: "/static/models/kws/keywords.txt",
      };

      console.log("Fetching model and keyword files...");
      const fetchFile = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load asset from ${url}`);
        const buf = await response.arrayBuffer();
        console.log(`Successfully fetched: ${url} (${buf.byteLength} bytes)`);
        return new Uint8Array(buf);
      };

      const [encoderData, decoderData, joinerData, tokensData, bpeData, keywordsData] = await Promise.all([
        fetchFile(fileUrls.encoder),
        fetchFile(fileUrls.decoder),
        fetchFile(fileUrls.joiner),
        fetchFile(fileUrls.tokens),
        fetchFile(fileUrls.bpe),
        fetchFile(fileUrls.keywords),
      ]);

      const keywordsText = new TextDecoder().decode(keywordsData);
      console.log("Keywords configuration string:\n", keywordsText);

      // 2. Setup dynamic Emscripten Module
      console.log("Initializing WebAssembly engine...");
      
      let resolveWasmInit: () => void;
      const wasmInitPromise = new Promise<void>((resolve) => {
        resolveWasmInit = resolve;
      });

      // Mount all possible directory prefixes for absolute reliability in MEMFS
      const customModule: any = {
        // Redirect standard I/O prints to console logs and store them for traceback
        print: (text: string) => {
          const logMsg = `[Sherpa-WASM STDOUT] ${text}`;
          console.log(logMsg);
          debugLogs.push(logMsg);
        },
        printErr: (text: string) => {
          const logMsg = `[Sherpa-WASM STDERR] ${text}`;
          console.error(logMsg);
          debugLogs.push(logMsg);
        },
        getPreloadedPackage: () => new ArrayBuffer(0),
        locateFile: (path: string) => {
          if (path === "sherpa-onnx-wasm-kws-main.wasm") {
            return "/static/models/kws/sherpa-onnx-wasm-kws-main.wasm";
          }
          return path;
        },
        MountedFiles: new Map<string, Uint8Array>([
          ["encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx", encoderData],
          ["decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx", decoderData],
          ["joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx", joinerData],
          ["tokens.txt", tokensData],
          ["bpe.model", bpeData],

          ["/encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx", encoderData],
          ["/decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx", decoderData],
          ["/joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx", joinerData],
          ["/tokens.txt", tokensData],
          ["/bpe.model", bpeData],

          ["./encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx", encoderData],
          ["./decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx", decoderData],
          ["./joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx", joinerData],
          ["./tokens.txt", tokensData],
          ["./bpe.model", bpeData],
        ]),
        onRuntimeInitialized: () => {
          console.log("WASM Runtime fully initialized!");
          resolveWasmInit();
        }
      };

      (window as any).Module = customModule;

      // 3. Dynamic Script Loading of Sherpa-ONNX WASM wrapper
      const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load script ${src}`));
          document.body.appendChild(script);
        });
      };

      await loadScript("/static/models/kws/sherpa-onnx-wasm-kws-main.js");
      await loadScript("/static/models/kws/sherpa-onnx-kws.js");

      // Wait for the WASM runtime initialization callback to execute
      await wasmInitPromise;

      // 4. Create Spotter Config with exact C++ offset alignment
      const kwsConfig = {
        featConfig: {
          samplingRate: 16000,
          featureDim: 80,
        },
        modelConfig: {
          transducer: {
            encoder: "./encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
            decoder: "./decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
            joiner: "./joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
          },
          tokens: "./tokens.txt",
          provider: "cpu",
          modelType: "",
          numThreads: 1,
          warmUp: 0,
          debug: 1, // Turn debug mode ON for extreme verbosity inside WASM console
          modelingUnit: "bpe",
          bpeVocab: "./bpe.model",
        },
        maxActivePaths: 4,
        numTrailingBlanks: 1,
        keywordsScore: 1.5,
        keywordsThreshold: 0.35,
        keywords: keywordsText,
      };

      console.log("Configuring Keyword Spotter with custom offsets...");
      
      const customKwsAlloc = initKwsConfigCustom(kwsConfig, customModule);
      const handle = customModule._SherpaOnnxCreateKeywordSpotter(customKwsAlloc.ptr);
      
      if (handle === 0) {
        throw new Error("Failed to create Keyword Spotter (handle is 0)");
      }
      
      freeKwsConfigCustom(customKwsAlloc, customModule);
      
      const recognizer = new (window as any).Kws(kwsConfig, customModule) as SherpaKws;
      recognizer.handle = handle; // Use our perfectly jumble-free handle!
      recognizerRef.current = recognizer;

      // 5. Initialize Microphone Stream
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const mediaStreamSource = audioCtx.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = mediaStreamSource;

      const bufferSize = 4096;
      const recorder = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      recorderNodeRef.current = recorder;

      // Setup KWS streams
      const recognizerStream = recognizer.createStream();
      streamRef.current = recognizerStream;

      recorder.onaudioprocess = (e) => {
        const inputSamples = e.inputBuffer.getChannelData(0);
        // Deep copy samples for safe WebAssembly manipulation
        const samples = new Float32Array(inputSamples);

        recognizerStream.acceptWaveform(16000, samples);

        while (recognizer.isReady(recognizerStream)) {
          recognizer.decode(recognizerStream);
          const result = recognizer.getResult(recognizerStream);

          if (result && result.keyword && result.keyword.trim().length > 0) {
            const detectedKeyword = result.keyword.trim();
            console.log(`[KWS] Match detected: "${detectedKeyword}"`);
            setLastCommand(detectedKeyword);
            commandManagerRef.current.triggerCommand(detectedKeyword);
            recognizer.reset(recognizerStream);
          }
        }
      };

      mediaStreamSource.connect(recorder);
      recorder.connect(audioCtx.destination);

      setEngineState("listening");
      console.log("Voice Command System successfully started!");
    } catch (err: any) {
      console.error("Failed to start voice command system:", err);
      
      // Extract details from tracked WASM standard console logs
      const stderrLines = debugLogs.filter(line => line.includes("STDERR"));
      let exceptionString = "Check browser dev console details.";
      if (stderrLines.length > 0) {
        exceptionString = `WASM Stderr: ${stderrLines.join(" | ")}`;
      } else if (debugLogs.length > 0) {
        exceptionString = `WASM logs: ${debugLogs.slice(-3).join(" | ")}`;
      }

      const formattedError = `Start Error (Address: ${err}): ${exceptionString}`;
      console.error("[DETAILED EXCEPTION] ->", formattedError);
      
      setErrorMsg(formattedError);
      setEngineState("error");
      stopListening();
    }
  };

  return (
    <div className="audio-voice-command-container mb-3 text-center">
      <div className="d-flex align-items-center justify-content-center gap-2">
        <button
          type="button"
          onClick={startVoiceEngine}
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

// Auto-mount the React Root element if it is present on the page
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("audio-command-root");
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <AudioCommandSystemComponent />
      </React.StrictMode>
    );
  }
});
