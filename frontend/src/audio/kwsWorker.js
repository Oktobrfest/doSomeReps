/**
 * Web Worker for Sherpa-ONNX Keyword Spotting.
 *
 * This worker owns the heavy WASM runtime (~43 MB of models) and runs
 * all neural network inference off the main thread. The main thread only
 * sends raw PCM chunks via postMessage and receives keyword detection
 * results back — keeping the UI responsive.
 *
 * NOTE: This must be a CLASSIC worker because Sherpa's Emscripten output
 * uses importScripts() which is unavailable in module workers.
 * This file is plain JavaScript (not TypeScript) so Vite can serve it
 * as-is without compilation issues.
 */

const KWS_BASE_URL = self.location.origin + "/static/models/kws";
const TARGET_SAMPLE_RATE = 16000;

// ---- Worker state ----

let recognizer = null;
let stream = null;
let cachedInputSampleRate = 0;

function postMsg(msg) {
  self.postMessage(msg);
}

// ---- Script loading (classic worker: importScripts is available) ----

function loadScript(src) {
  return new Promise((resolve, reject) => {
    try {
      importScripts(src);
      resolve();
    } catch (err) {
      reject(new Error("Failed to load script: " + src + " — " + String(err)));
    }
  });
}

// ---- Audio resampling (linear interpolation) ----

function resampleLinear(input, inputRate, outputRate) {
  if (inputRate === outputRate) return new Float32Array(input);

  var ratio = inputRate / outputRate;
  var outputLength = Math.max(1, Math.round(input.length / ratio));
  var output = new Float32Array(outputLength);

  for (var i = 0; i < outputLength; i++) {
    var srcIndex = i * ratio;
    var i0 = Math.floor(srcIndex);
    var i1 = Math.min(i0 + 1, input.length - 1);
    var frac = srcIndex - i0;
    output[i] = input[i0] + (input[i1] - input[i0]) * frac;
  }
  return output;
}

// ---- Keyword normalization ----

function normalizeKeyword(input) {
  return input.toUpperCase().trim();
}

// ---- Initialization ----

async function initialize() {
  var debugLogs = [];

  // Set up the Emscripten Module object before loading scripts
  self.Module = {
    print: function (text) {
      debugLogs.push("[Sherpa-WASM STDOUT] " + text);
    },
    printErr: function (text) {
      debugLogs.push("[Sherpa-WASM] " + text);
    },
    locateFile: function (path) {
      return KWS_BASE_URL + "/" + path;
    },
    onRuntimeInitialized: function () {
      console.log("[KWS Worker] Sherpa WASM runtime initialized.");
    },
  };

  try {
    await loadScript(KWS_BASE_URL + "/sherpa-onnx-kws.js");
    await loadScript(KWS_BASE_URL + "/sherpa-onnx-wasm-kws-main.js");
  } catch (err) {
    var tail = debugLogs.slice(-5).join("\n");
    throw new Error(
      "Failed to initialize Sherpa WASM in worker. " + String(err) + "\n" + tail
    );
  }

  if (typeof self.createKws !== "function") {
    throw new Error("Sherpa createKws() was not found after loading scripts.");
  }

  // Build keyword spotter config
  var res = await fetch(KWS_BASE_URL + "/keywords.txt");
  if (!res.ok) {
    throw new Error(
      "Failed to fetch keywords.txt: " + res.status + " " + res.statusText
    );
  }
  var keywordsText = await res.text();

  var config = {
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
    keywords: keywordsText,
  };

  console.log("[KWS Worker] Creating keyword spotter...");
  recognizer = self.createKws(self.Module, config);
  stream = recognizer.createStream();
  console.log("[KWS Worker] Keyword spotter ready.");
}

// ---- Audio processing ----

function processAudioChunk(samples, inputSampleRate) {
  if (!recognizer || !stream) return;

  if (cachedInputSampleRate === 0) {
    cachedInputSampleRate = inputSampleRate;
  }

  var resampled = resampleLinear(samples, inputSampleRate, TARGET_SAMPLE_RATE);
  stream.acceptWaveform(TARGET_SAMPLE_RATE, resampled);

  // Track if we've actually done any decoding this chunk
  var didDecode = false;
  while (recognizer.isReady(stream)) {
    recognizer.decode(stream);
    didDecode = true;
  }

  // Only call getResult if we've processed audio.
  // Calling getResult when there's not enough audio can cause JSON parse errors.
  if (!didDecode) return;

  // Protect against getResult throwing on incomplete streams
  var result;
  var keyword = "";
  try {
    result = recognizer.getResult(stream);
    keyword = result && result.keyword ? normalizeKeyword(result.keyword) : "";
  } catch (err) {
    // getResult can fail when there's not enough audio data for a valid result
    // This is normal during initial buffering - ignore and continue
    return;
  }
  if (!keyword) return;

  console.log('[KWS Worker] Match detected: "' + keyword + '"');
  postMsg({ type: "keyword", keyword: keyword });

  recognizer.reset(stream);
}

// ---- Cleanup ----

function cleanup() {
  try {
    if (stream) {
      stream.free();
      stream = null;
    }
    if (recognizer) {
      recognizer.free();
      recognizer = null;
    }
  } catch (err) {
    console.error("[KWS Worker] Error during cleanup:", err);
  }
  cachedInputSampleRate = 0;
}

// ---- Message handler ----

self.onmessage = async function (event) {
  var msg = event.data;

  switch (msg.type) {
    case "init":
      try {
        await initialize();
        postMsg({ type: "ready" });
      } catch (err) {
        postMsg({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;

    case "audio-chunk":
      if (!recognizer || !stream) return;
      // The chunk is transferred as an ArrayBuffer; reconstruct Float32Array
      var samples = new Float32Array(msg.chunk);
      var sampleRate = cachedInputSampleRate || 44100;
      processAudioChunk(samples, sampleRate);
      break;

    case "reset":
      if (recognizer && stream) {
        try {
          recognizer.reset(stream);
        } catch (e) {
          /* ignore */
        }
      }
      break;

    case "stop":
      cleanup();
      break;
  }
};
