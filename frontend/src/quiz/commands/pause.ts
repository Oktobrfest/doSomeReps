import { AudioCommandManager } from '../AudioCommandManager';

export function registerPause(manager: AudioCommandManager) {
  manager.registerCommand('PAUSE', () => {
    const audioPause = (window as unknown as { audioPause?: () => void }).audioPause;

    if (typeof audioPause === 'function') {
      audioPause();
    }
  });
}
