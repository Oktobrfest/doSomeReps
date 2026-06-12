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

let KWS_BASE_URL = "";
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
  console.log("[KWS Worker] Starting initialization... Base URL: " + KWS_BASE_URL);
  var debugLogs = [];

  // Set up the Emscripten Module object before loading scripts
  var wasmReadyResolve;
  var wasmReady = new Promise(function (resolve) {
    wasmReadyResolve = resolve;
  });

  self.Module = {
    print: function (text) {
      console.log("[Sherpa-WASM STDOUT] " + text);
      debugLogs.push("[Sherpa-WASM STDOUT] " + text);
    },
    printErr: function (text) {
      console.error("[Sherpa-WASM STDERR] " + text);
      debugLogs.push("[Sherpa-WASM STDERR] " + text);
    },
    locateFile: function (path) {
      var resolved = KWS_BASE_URL + "/" + path;
      console.log("[KWS Worker] locateFile: " + path + " -> " + resolved);
      return resolved;
    },
    mainScriptUrlOrBlob: KWS_BASE_URL + "/sherpa-onnx-wasm-kws-main.js",
    setStatus: function (text) {
      console.log("[KWS Worker Status] " + text);
    },
    onRuntimeInitialized: function () {
      console.log("[KWS Worker] Sherpa WASM runtime initialized successfully.");
      if (typeof wasmReadyResolve === "function") {
        wasmReadyResolve();
      }
    },
  };

  try {
    console.log("[KWS Worker] Loading sherpa-onnx-kws.js...");
    await loadScript(KWS_BASE_URL + "/sherpa-onnx-kws.js");
    console.log("[KWS Worker] Loading sherpa-onnx-wasm-kws-main.js...");
    await loadScript(KWS_BASE_URL + "/sherpa-onnx-wasm-kws-main.js");

    console.log("[KWS Worker] Waiting for WASM runtime initialization...");
    await Promise.race([
      wasmReady,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("Timed out waiting for Sherpa WASM runtime to initialize."));
        }, 120000);
      }),
    ]);
  } catch (err) {
    var tail = debugLogs.slice(-10).join("\n");
    throw new Error(
      "Failed to initialize Sherpa WASM in worker. Base URL: " +
        KWS_BASE_URL +
        "\n" +
        String(err) +
        "\n" +
        tail
    );
  }

  if (typeof self.createKws !== "function") {
    throw new Error("Sherpa createKws() was not found after loading scripts.");
  }

  // Build keyword spotter config
  console.log("[KWS Worker] Fetching keywords.txt...");
  var res = await fetch(KWS_BASE_URL + "/keywords.txt");
  if (!res.ok) {
    throw new Error(
      "Failed to fetch keywords.txt: " + res.status + " " + res.statusText
    );
  }
  var keywordsText = await res.text();
  console.log("[KWS Worker] keywords.txt fetched successfully. File size: " + keywordsText.length + " bytes.");

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
        KWS_BASE_URL = msg.baseUrl || (self.location.origin + "/static/models/kws");
        console.log("[KWS Worker] init message received. KWS_BASE_URL set to: " + KWS_BASE_URL);
        await initialize();
        postMsg({ type: "ready" });
      } catch (err) {
        console.error("[KWS Worker] Init failed:", err);
        postMsg({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;

      case "audio-chunk":
        if (!recognizer || !stream) return;

        var samples =
          msg.chunk instanceof Float32Array
            ? msg.chunk
            : new Float32Array(msg.chunk);

        var sampleRate = Number(msg.sampleRate) || cachedInputSampleRate || TARGET_SAMPLE_RATE;

        if (cachedInputSampleRate === 0) {
          cachedInputSampleRate = sampleRate;
        }

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
