import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';

import { AudioCommandManager } from './AudioCommandManager';
import { buildWorkletBlobUrl } from './audioCapture';
import { KwsWorkerClient } from './kwsWorkerClient';
import type { WorkerState } from './kwsWorkerClient';
import { registerReload } from './commands/reload';
import { registerStopListening } from './commands/stopListening';
import { resolveQuizCommandHandler } from './commands/resolveQuizCommand';
import styles from './AudioCommandSystem.module.css';
import actionStyles from './ActionButton.module.css';
import type { AudioCommandHandlers } from './types';
import {
  logMediaStreamDiagnostics,
  logAudioContextDiagnostics,
  logAudioDiagnostic,
  probeAudioContextSampleRateSupport,
} from './audioDiagnostics';
import { cx } from './AudioControls';

const AVAILABLE_COMMANDS = [
  'READ QUESTION',
  'GET ANSWER',
  'CORRECT',
  'WRONG',
  'PAUSE',
  'RESUME',
  'RELOAD',
  'ASK AI',
  'STOP LISTENING',
];

interface AudioCommandSystemComponentProps {
  commands?: AudioCommandHandlers;
  commandsDisabled?: boolean;
}

export interface AudioCommandSystemHandle {
  /** Resume listening if the user had it active before an interruption such as Ask AI. */
  resumeListening: () => void;
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function normalizeCommand(command: string) {
  return command.toUpperCase().trim().replace(/\s+/g, ' ');
}

// AudioWorklet batching: samples accumulated before posting one frame.
// 1280 @48k ≈ 26.7ms ≈ ~37 msgs/sec (vs ~375/sec at the 128-sample default).
// Tune: 512 (lower latency, more msgs) / 1024 / 2048 (less overhead, more latency).
// Does NOT change sample rate or resampling.
const PCM_WORKLET_FRAME_SIZE = 1280;
const dontListenWhenPlayerAudioPlays = true;

// Drop audio older than this — captured during a main-thread stall. Kept just
// under the worker's own 350ms backstop so the two layers agree.
const STALE_CHUNK_MS = 300;

export const AudioCommandSystemComponent = forwardRef<
  AudioCommandSystemHandle,
  AudioCommandSystemComponentProps
>(function AudioCommandSystemComponent(
  {
    commands,
    commandsDisabled = false,
  }: AudioCommandSystemComponentProps,
  ref,
) {
  const commandsRef = useLatestRef(commands);
  const commandsDisabledRef = useLatestRef(commandsDisabled);
  const [engineState, setEngineState] = useState<WorkerState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Refs for audio capture (these stay on the main thread — only PCM routing)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workletUrlRef = useRef<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputSampleRateRef = useRef<number>(44100);

  // Refs for worker and command manager
  const kwsWorkerRef = useRef<KwsWorkerClient | null>(null);
  const commandManagerRef = useRef(new AudioCommandManager());
  const isStartingRef = useRef(false);

  // Custom logging helper to keep everything consistent
  const logDebug = (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) console.log(`[AudioCommandSystem] ${message}`, ...args);
  };

  // Expose imperative actions for parent coordination (e.g. Ask AI resuming listening).
  useImperativeHandle(
    ref,
    () => ({
      resumeListening: () => {
        if (engineState === 'idle') {
          void startListening();
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Clear detected command display after 6 seconds
  useEffect(() => {
    if (!lastCommand) return;
    const timer = setTimeout(() => setLastCommand(null), 6000);
    return () => clearTimeout(timer);
  }, [lastCommand]);

  // Register/unregister this component's stop callback for global audio coordination.
  useEffect(() => {
    const stopMe = () => {
      // Intentionally no-op here; Ask AI lives in AudioQuiz and owns its own
      // playback state. This callback slot remains so that other consumers can
      // stop everything without knowing component boundaries.
    };
    if (!(window as any).__audioStopCallbacks) {
      (window as any).__audioStopCallbacks = [];
    }
    (window as any).__audioStopCallbacks.push(stopMe);
    return () => {
      const arr: Array<(() => void) | undefined> = (window as any).__audioStopCallbacks;
      if (arr) {
        const idx = arr.indexOf(stopMe);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }, []);

  // Build a stable callback-based interface for the KWS worker
  const runCommand = useCallback(
    (keyword: string) => {
      const normalized = normalizeCommand(keyword);

      if (normalized === 'ASK AI') {
        if (!commandsDisabledRef.current) {
          const wasListening =
            engineState === 'listening' ||
            sessionStorage.getItem('audio_listening_active') === 'true';
          stopListeningCleanup();
          commandsRef.current?.askAi?.(wasListening);
        }
        return;
      }

      const quizCommandHandler = resolveQuizCommandHandler(
        keyword,
        commandsRef.current,
      );

      if (quizCommandHandler) {
        if (!commandsDisabledRef.current) {
          quizCommandHandler();
        }
        return;
      }

      // Non-quiz commands, such as Reload or Stop Listening, can still
      // be handled by the existing internal AudioCommandManager registration.
      commandManagerRef.current.triggerCommand(keyword);
    },
    [commandsRef, commandsDisabledRef, engineState],
  );

  const handleKeyword = useCallback(
    (keyword: string) => {
      logDebug(`Keyword matched in worker: "${keyword}"`);
      setLastCommand(keyword);

      runCommand(keyword);

      // Reset worker state after detection to avoid repeats.
      kwsWorkerRef.current?.reset();
    },
    [runCommand],
  );

  // Register commands once.
  useEffect(() => {
    logDebug('Registering all audio commands...');
    const manager = commandManagerRef.current;
    registerReload(manager);
    registerStopListening(manager);
    // ASK AI is handled directly by the parent (AudioQuiz), so register a
    // guard that warns if no handler is wired.
    manager.registerCommand('ASK AI', () => {
      if (!commandsRef.current?.askAi) {
        console.warn(
          '[AudioCommandSystem] ASK AI triggered but no askAi handler is registered.',
        );
      }
    });

    const exitBtn = document.getElementById('exit-audio-mode');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        logDebug('Exit button clicked; disabling future auto-listen.');
        sessionStorage.setItem('audio_listening_active', 'false');
      });
    }

    return () => {
      logDebug('Unmounting component: performing cleanup.');
      stopListeningCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start listening if previously active
  useEffect(() => {
    const wasListening = sessionStorage.getItem('audio_listening_active') === 'true';
    logDebug(`Checking auto-start. wasListening: ${wasListening}`);
    if (wasListening) {
      const timer = setTimeout(() => {
        logDebug('Auto-starting audio listening system...');
        void startListening();
      }, 150);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close hamburger menu on outside clicks
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = () => setMenuOpen(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  // ---- Audio capture cleanup (main thread only) ----

  const stopAudioCapture = () => {
    logDebug('Stopping audio capture stream & nodes...');
    try {
      if (workletNodeRef.current) {
        logDebug('Disconnecting AudioWorkletNode...');
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }
      if (sourceRef.current) {
        logDebug('Disconnecting MediaStreamAudioSourceNode...');
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (mediaStreamRef.current) {
        logDebug('Stopping tracks in media stream...');
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        logDebug('Closing AudioContext...');
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (workletUrlRef.current) {
        logDebug('Revoking AudioWorklet object URL...');
        URL.revokeObjectURL(workletUrlRef.current);
        workletUrlRef.current = null;
      }
    } catch (err) {
      console.warn('Error during audio capture cleanup:', err);
    }
  };

  // ---- Full stop: worker + audio capture ----

  const stopListeningCleanup = () => {
    logDebug('Performing stopListeningCleanup...');
    stopAudioCapture();
    if (kwsWorkerRef.current) {
      logDebug('Stopping and terminating KwsWorkerClient...');
      kwsWorkerRef.current.stop();
      kwsWorkerRef.current = null;
    }
    isStartingRef.current = false;
    setEngineState('idle');
    logDebug('Listening cleanup complete.');
  };

  const stopListening = (manual = false) => {
    logDebug(`stopListening called. manual: ${manual}`);
    stopListeningCleanup();
    if (manual) {
      sessionStorage.setItem('audio_listening_active', 'false');
    }
  };

  // Expose global stop function
  const stopListeningCb = useCallback(() => stopListening(true), []);
  useEffect(() => {
    (window as any).stopAudioListening = stopListeningCb;
    return () => {
      delete (window as any).stopAudioListening;
    };
  }, [stopListeningCb]);

  // ---- Start listening ----

  const startListening = async () => {
    logDebug(
      `startListening initiated. isStartingRef: ${isStartingRef.current}, engineState: ${engineState}`,
    );
    if (isStartingRef.current || engineState === 'loading') return;
    if (engineState === 'listening' || engineState === 'ready') {
      logDebug('Already listening or ready, triggering stop instead.');
      stopListening(true);
      return;
    }

    isStartingRef.current = true;
    setEngineState('loading');
    setErrorMsg(null);
    setLastCommand(null);

    try {
      // 1. Start the KWS Web Worker (handles all WASM/model loading off main thread)
      logDebug('Instantiating KwsWorkerClient...');
      const kwsWorker = new KwsWorkerClient({
        onKeyword: handleKeyword,
        onReady: () => {
          logDebug('KWS Worker is ready! Proceeding with audio capture on main thread.');
        },
        onError: (msg) => {
          console.error('[KwsWorkerClient Callback] Error received from worker:', msg);
          setErrorMsg(msg);
          stopListeningCleanup();
        },
        onStateChange: (state) => {
          logDebug(`Worker state changed to: ${state}`);
          // Don't override "listening" with "ready" — audio capture is the final step
          if (state === 'ready') return;
          setEngineState(state);
        },
      });

      kwsWorkerRef.current = kwsWorker;
      logDebug('Triggering start on KwsWorkerClient...');
      await kwsWorker.start();

      // 2. Start microphone capture
      // One-time probe: does this device/browser honor a forced 16k context?
      // Throwaway contexts only — does NOT touch the live pipeline. Safe to delete later.
      await probeAudioContextSampleRateSupport(16000);

      logDebug('Requesting microphone permission...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = mediaStream;
      logDebug('Microphone permission granted.');

      // One-time: what did the mic track actually negotiate (rate, channels, AEC/NS/AGC)?
      logMediaStreamDiagnostics(mediaStream);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        logDebug('AudioContext is suspended; resuming now...');
        await audioCtx.resume();
      }
      audioCtxRef.current = audioCtx;

      inputSampleRateRef.current = audioCtx.sampleRate;
      logDebug(`AudioContext active. Sample rate: ${audioCtx.sampleRate}`);

      // One-time: live context details + does the context rate match the mic track rate?
      logAudioContextDiagnostics(audioCtx, 'Live AudioContext');
      {
        const _track = mediaStream.getAudioTracks()[0];
        const _settings = _track?.getSettings?.() ?? {};
        logAudioDiagnostic('Sample-rate comparison', {
          audioCtx_sampleRate: audioCtx.sampleRate,
          mediaTrack_sampleRate: (_settings as any).sampleRate,
          mediaTrack_channelCount: (_settings as any).channelCount,
          note: 'If these two rates differ, resampling is using the wrong input rate.',
        });
      }

      // Register the PCM capture worklet
      const workletUrl = buildWorkletBlobUrl();
      workletUrlRef.current = workletUrl;
      logDebug('Adding PCM capture worklet module to AudioContext...');
      await audioCtx.audioWorklet.addModule(workletUrl);
      logDebug('PCM capture worklet module successfully loaded.');

      const source = audioCtx.createMediaStreamSource(mediaStream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        processorOptions: { frameSize: PCM_WORKLET_FRAME_SIZE },
      });
      workletNodeRef.current = workletNode;

      // One-time confirmation; the [KWS] heartbeat shows the resulting frames/sec.
      if (import.meta.env.DEV) {
        console.log(
          '[KWS] worklet batching: frame ' +
            PCM_WORKLET_FRAME_SIZE +
            ' samples (~' +
            ((PCM_WORKLET_FRAME_SIZE / audioCtx.sampleRate) * 1000).toFixed(1) +
            'ms, ~' +
            (audioCtx.sampleRate / PCM_WORKLET_FRAME_SIZE).toFixed(0) +
            ' msg/s)',
        );
      }

      let micGatedByPlayback = false;
      let staleGap = false;
      workletNode.port.onmessage = (
        event: MessageEvent<{ frame: Float32Array; captureTs: number }>,
      ) => {
        const { frame: chunk, captureTs } = event.data;
        if (!chunk || chunk.length === 0) return;

        // Pre-drop audio captured during a main-thread stall. captureTs is from the
        // audio thread, so it stays accurate even though THIS handler is exactly what
        // gets delayed when the main thread janks (flushSync verdict + question swap +
        // autoplay). Without it, a stall drains a burst of seconds-old frames at once
        // and the worker fires every buffered command in turn. Dropping here also
        // skips the transfer for frames the worker would discard anyway.
        if (Date.now() - captureTs > STALE_CHUNK_MS) {
          staleGap = true;
          return;
        }

        if (dontListenWhenPlayerAudioPlays && (window as any).__audioPlaying) {
          micGatedByPlayback = true;
          return;
        }

        // Resuming after any drop (stall or playback): flush partial recognizer state
        // so the discontinuity can't emit a phantom partial match.
        if (micGatedByPlayback || staleGap) {
          micGatedByPlayback = false;
          staleGap = false;
          kwsWorkerRef.current?.reset();
        }

        kwsWorkerRef.current?.sendAudioChunk(chunk, audioCtx.sampleRate, captureTs);
      };

      source.connect(workletNode);

      setEngineState('listening');
      sessionStorage.setItem('audio_listening_active', 'true');
      logDebug('Voice command system fully initialized and listening.');
    } catch (err) {
      console.error('Failed to start voice command system:', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      stopListeningCleanup();
    } finally {
      isStartingRef.current = false;
    }
  };

  const isListening = engineState === 'listening';

  const renderControls = (isBanner: boolean) => {
    return (
      <div className={cx(styles.controlsRow, isBanner && styles.bannerControlsRow)}>
        <div className={styles.splitButtonContainer}>
          <button
            type="button"
            onClick={startListening}
            disabled={engineState === 'loading'}
            className={cx(
              actionStyles.largeBtn,
              styles.mainSplitBtn,
              isListening && cx(actionStyles.redBtn, styles.pulseListening),
              engineState === 'loading' && actionStyles.orangeBtn,
              engineState === 'idle' && actionStyles.greenBtn,
              isBanner && styles.bannerMainSplitBtn,
            )}
          >
            {isListening ? (
              <div className={styles.btnContentCol}>
                <div className={actionStyles.btnContent}>
                  <span className={styles.spinnerGrow} role="status" aria-hidden="true"></span>
                  <span>Listening for commands...</span>
                </div>
                {lastCommand && (
                  <div className={styles.detectedInside}>
                    Detected: <span className={styles.commandBadgeInside}>{lastCommand}</span>
                  </div>
                )}
              </div>
            ) : engineState === 'loading' ? (
              <div className={actionStyles.btnContent}>
                <span className={styles.spinnerBorder} role="status" aria-hidden="true"></span>
                <span>Initializing...</span>
              </div>
            ) : (
              <div className={actionStyles.btnContent}>
                <span className={styles.micIcon}>🎤</span>
                <span>Listen</span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className={cx(
              actionStyles.largeBtn,
              styles.menuSplitBtn,
              isListening && actionStyles.redBtn,
              engineState === 'loading' && actionStyles.orangeBtn,
              engineState === 'idle' && actionStyles.greenBtn,
              isBanner && styles.bannerMenuSplitBtn,
            )}
            title="Available commands"
          >
            ☰
          </button>

          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownHeader}>Available Commands</div>
              {AVAILABLE_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  className={styles.dropdownItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    runCommand(cmd);
                  }}
                >
                  {cmd}
                </button>
              ))}
            </div>
          )}
        </div>

        {isListening && (
          <button
            type="button"
            className={styles.stopButton}
            onClick={() => stopListening(true)}
            title="Stop listening"
          >
            ⏹
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className={cx(
        styles.voiceCommandContainer,
        isListening && styles.voiceCommandContainerListening,
      )}
    >
      {isListening ? (
        <div className={styles.listeningBanner}>{renderControls(true)}</div>
      ) : (
        renderControls(false)
      )}

      {errorMsg && (
        <div className={styles.errorMessage}>
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
});
