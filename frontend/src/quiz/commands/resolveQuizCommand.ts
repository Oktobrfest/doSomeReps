import type { QuizCommandHandlers, CommandCallback } from '../types';

function normalizeCommand(command: string) {
  return command.toUpperCase().trim().replace(/\s+/g, ' ');
}

export function resolveQuizCommandHandler(
  rawCommand: string,
  handlers: QuizCommandHandlers | undefined,
): CommandCallback | null {
  if (!handlers) return null;

  switch (normalizeCommand(rawCommand)) {
    case 'CORRECT':
      return handlers.correct;

    case 'WRONG':
    case 'INCORRECT':
      return handlers.wrong;

    case 'SLIGHTLY WRONG':
    case 'SLIGHTLY':
    case 'PARTIALLY WRONG':
      return handlers.slightlyWrong;

    case 'GET ANSWER':
    case 'ANSWER':
    case 'SHOW ANSWER':
      return handlers.getAnswer;

    case 'READ QUESTION':
    case 'QUESTION':
      return handlers.readQuestion;

    case 'PAUSE':
      return handlers.pause;

    case 'RESUME':
      return handlers.resume;

    default:
      return null;
  }
}
