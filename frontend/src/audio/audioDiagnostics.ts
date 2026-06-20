export function logAudioDiagnostic(label: string, data: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  const safeData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (typeof value === "function") return [key, "[function]"];
      return [key, value];
    })
  );
  console.groupCollapsed(`[AudioDiag] ${label}`);
  console.table(safeData);
  console.groupEnd();
}

export function logMediaStreamDiagnostics(stream: MediaStream) {
  if (!import.meta.env.DEV) return;
  const tracks = stream.getAudioTracks();
  logAudioDiagnostic("MediaStream summary", {
    trackCount: tracks.length,
    streamActive: stream.active,
    streamId: stream.id,
  });
  tracks.forEach((track, index) => {
    const settings = track.getSettings?.() ?? {};
    const constraints = track.getConstraints?.() ?? {};
    const capabilities =
      typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
    logAudioDiagnostic(`AudioTrack[${index}]`, {
      id: track.id,
      label: track.label || "(empty)",
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      settings_sampleRate: (settings as any).sampleRate,
      settings_channelCount: (settings as any).channelCount,
      settings_latency: (settings as any).latency,
      settings_echoCancellation: (settings as any).echoCancellation,
      settings_noiseSuppression: (settings as any).noiseSuppression,
      settings_autoGainControl: (settings as any).autoGainControl,
      constraints_sampleRate: (constraints as any).sampleRate,
      constraints_channelCount: (constraints as any).channelCount,
      capabilities_sampleRate: JSON.stringify((capabilities as any).sampleRate),
      capabilities_channelCount: JSON.stringify((capabilities as any).channelCount),
      capabilities_echoCancellation: JSON.stringify((capabilities as any).echoCancellation),
      capabilities_noiseSuppression: JSON.stringify((capabilities as any).noiseSuppression),
      capabilities_autoGainControl: JSON.stringify((capabilities as any).autoGainControl),
    });
  });
}

export function logAudioContextDiagnostics(audioCtx: AudioContext, label = "AudioContext") {
  if (!import.meta.env.DEV) return;
  logAudioDiagnostic(label, {
    state: audioCtx.state,
    sampleRate: audioCtx.sampleRate,
    baseLatency: (audioCtx as any).baseLatency,
    outputLatency: (audioCtx as any).outputLatency,
    currentTime: audioCtx.currentTime,
    destinationMaxChannelCount: audioCtx.destination.maxChannelCount,
    destinationChannelCount: audioCtx.destination.channelCount,
  });
}

/**
 * Diagnostic only. Creates throwaway contexts to test whether the browser
 * honors a forced sample rate. Does NOT touch the live pipeline.
 */
export async function probeAudioContextSampleRateSupport(requestedRate = 16000) {
  if (!import.meta.env.DEV) return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    logAudioDiagnostic("AudioContext probe failed", { error: "AudioContext unavailable" });
    return;
  }
  let defaultCtx: AudioContext | null = null;
  let requestedCtx: AudioContext | null = null;
  try {
    defaultCtx = new AudioContextClass();
    try {
      requestedCtx = new AudioContextClass({ sampleRate: requestedRate });
    } catch (err) {
      logAudioDiagnostic("Requested AudioContext constructor failed", {
        requestedRate,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    logAudioDiagnostic("AudioContext sampleRate probe", {
      requestedRate,
      defaultCtx_sampleRate: defaultCtx.sampleRate,
      requestedCtx_sampleRate: requestedCtx?.sampleRate ?? "(creation failed)",
      requestedHonored: requestedCtx ? requestedCtx.sampleRate === requestedRate : false,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    });
  } finally {
    try { if (defaultCtx && defaultCtx.state !== "closed") await defaultCtx.close(); } catch {}
    try { if (requestedCtx && requestedCtx.state !== "closed") await requestedCtx.close(); } catch {}
  }
}
