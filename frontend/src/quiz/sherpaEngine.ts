export const KWS_BASE_URL = "/static/models/kws";
export const TARGET_SAMPLE_RATE = 16000;

export function loadScript(src: string): Promise<void> {
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

export async function buildKwsConfig(): Promise<any> {
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

export async function initializeSherpa(): Promise<void> {
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
}
