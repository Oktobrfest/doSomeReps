import { AudioCommandManager } from '../AudioCommandManager';

export function registerReadQuestion(manager: AudioCommandManager) {
  manager.registerCommand('READ QUESTION', () => {
    const audioReadQuestion = (
      window as unknown as { audioReadQuestion?: () => void }
    ).audioReadQuestion;

    if (typeof audioReadQuestion === 'function') {
      audioReadQuestion();
    }
  });
}
