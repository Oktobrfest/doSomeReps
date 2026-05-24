export interface SherpaStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  inputFinished(): void;
  free(): void;
}

export interface SherpaKws {
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  reset(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { keyword?: string };
  free(): void;
}

export type EngineState = "idle" | "loading" | "listening" | "error";
export type CommandCallback = () => void;

declare global {
  interface Window {
    Module?: any;
    createKws?: (module: any, config?: any) => SherpaKws;
    audioReadQuestion?: () => void;
  }
}
