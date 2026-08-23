import { AudioCommandManager } from '../AudioCommandManager';

export function registerResume(manager: AudioCommandManager) {
  manager.registerCommand('RESUME', () => {
    const audioResume = (window as unknown as { audioResume?: () => void }).audioResume;

    if (typeof audioResume === 'function') {
      audioResume();
    }
  });
}
