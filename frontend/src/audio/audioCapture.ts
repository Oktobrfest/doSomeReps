export const PCM_WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const requested = options && options.processorOptions && options.processorOptions.frameSize;
    const n = Number(requested);
    this.frameSize = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1280;
    this.buffer = new Float32Array(this.frameSize);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;

    let i = 0;
    while (i < channel.length) {
      const space = this.frameSize - this.offset;
      const left = channel.length - i;
      const take = Math.min(space, left);
      this.buffer.set(channel.subarray(i, i + take), this.offset);
      this.offset += take;
      i += take;

      if (this.offset === this.frameSize) {
        const frame = this.buffer;
        this.buffer = new Float32Array(this.frameSize); // reallocate before transfer
        this.offset = 0;
        this.port.postMessage({ frame, captureTs: Date.now() }, [frame.buffer]);   // transfer (cheap; the real win is fewer messages)
      }
    }
    // Partial tail on teardown is intentionally dropped.
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

export function buildWorkletBlobUrl(): string {
  const blob = new Blob([PCM_WORKLET_SOURCE], { type: "text/javascript" });
  return URL.createObjectURL(blob);
}
