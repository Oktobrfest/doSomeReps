let keepAliveEl: HTMLAudioElement | null = null;
let keepAliveUrl: string | null = null;
let refCount = 0;

const SILENCE_SECONDS = 12;
const SAMPLE_RATE = 8000;

/** Build a 12s 8kHz 16-bit mono silent WAV at runtime (all-zero PCM data). */
function buildSilentWavUrl(): string {
  const numSamples = SAMPLE_RATE * SILENCE_SECONDS;
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);   // fmt chunk size
  view.setUint16(20, 1, true);    // PCM
  view.setUint16(22, 1, true);    // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true);    // block align
  view.setUint16(34, 16, true);   // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  // PCM payload is left as zeros = digital silence.

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

/**
 * Hold the media session open. Ref-counted, so several players can hold it
 * at once without fighting each other.
 */
export function acquireMediaSessionKeepAlive(): void {
  refCount += 1;

  if (!keepAliveEl) {
    keepAliveUrl = buildSilentWavUrl();
    keepAliveEl = new Audio(keepAliveUrl);
    keepAliveEl.loop = true;
    // Not `muted`: Chromium skips creating a session for muted elements.
    // Near-zero volume on already-silent content is inaudible either way.
    keepAliveEl.volume = 0.001;
    keepAliveEl.preload = 'auto';
  }

  void keepAliveEl.play().catch(() => {
    // Autoplay refusal is non-fatal; only the resume-via-headset path degrades.
  });
}

/** Release one hold. The element stops once every holder has released. */
export function releaseMediaSessionKeepAlive(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && keepAliveEl) {
    keepAliveEl.pause();
  }
}