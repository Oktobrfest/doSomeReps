/**
 * Client for the KWS Web Worker.
 *
 * Handles worker lifecycle and communication. The main thread uses this
 * instead of directly managing Sherpa WASM, keeping the UI responsive.
 */

export type WorkerState = "idle" | "loading" | "ready" | "listening" | "error";

export interface KwsWorkerCallbacks {
  onKeyword: (keyword: string) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onStateChange: (state: WorkerState) => void;
}

export class KwsWorkerClient {
  private worker: Worker | null = null;
  private callbacks: KwsWorkerCallbacks;
  private _state: WorkerState = "idle";

  constructor(callbacks: KwsWorkerCallbacks) {
    this.callbacks = callbacks;
  }

  get state(): WorkerState {
    return this._state;
  }

  private setState(state: WorkerState) {
    this._state = state;
    this.callbacks.onStateChange(state);
  }

  async start(): Promise<void> {
    if (this.worker) return;

    this.setState("loading");

    try {
      // Create a classic worker (Sherpa Emscripten output uses importScripts,
      // which is not available in module workers).
      // Vite handles worker bundling automatically when using the ?worker suffix
      // or when the file is referenced via new URL with { type: "classic" }.
      // For classic workers, we construct the URL and let Vite bundle it.
      const workerUrl = new URL("./kwsWorker.js", import.meta.url);
      this.worker = new Worker(workerUrl, { type: "classic" });

      this.worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        switch (msg.type) {
          case "ready":
            this.setState("ready");
            this.callbacks.onReady();
            break;
          case "keyword":
            this.callbacks.onKeyword(msg.keyword);
            break;
          case "error":
            this.setState("error");
            this.callbacks.onError(msg.message);
            break;
        }
      };

      this.worker.onerror = (err) => {
        console.error("[KWS Worker Client] Worker error:", err);
        this.setState("error");
        this.callbacks.onError(`Worker error: ${err.message}`);
      };

      // Tell the worker to initialize Sherpa
      this.worker.postMessage({ type: "init" });
    } catch (err) {
      this.setState("error");
      this.callbacks.onError(
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Send a raw PCM audio chunk to the worker for keyword spotting.
   * The chunk should be Float32Array PCM samples.
   */
  sendAudioChunk(chunk: Float32Array): void {
    if (!this.worker || this._state !== "ready") return;
    // Transfer ownership of the buffer to avoid copying
    this.worker.postMessage(
      { type: "audio-chunk", chunk },
      [chunk.buffer]
    );
  }

  /**
   * Reset the keyword spotter state (e.g. after a detection to avoid repeats).
   */
  reset(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: "reset" });
  }

  /**
   * Stop the worker and free all resources.
   */
  stop(): void {
    if (!this.worker) return;
    try {
      this.worker.postMessage({ type: "stop" });
    } catch { /* worker may already be terminated */ }
    this.worker.terminate();
    this.worker = null;
    this.setState("idle");
  }
}
