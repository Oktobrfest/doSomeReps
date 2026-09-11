import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAskAi } from './useAskAi';
import { AskAiPanel } from './AskAiPanel';
import type { AskAiContext } from './types';
import sharedStyles from '../styles/shared.module.css';

export interface AskAiLauncherProps {
  questionId: string | number;
  questionText: string;
  answerText?: string;
  answerRevealed?: boolean;
  categories?: string[];
  questionImageUrls?: string[];
  answerImageUrls?: string[];
  inline?: boolean;
}

export function AskAiLauncher({
  questionId,
  questionText,
  answerText,
  answerRevealed = false,
  categories,
  questionImageUrls,
  answerImageUrls,
  inline = false,
}: AskAiLauncherProps) {
  const context = useMemo<AskAiContext>(
    () => ({
      questionId,
      questionText,
      answerText,
      categories,
      questionImageUrls,
      answerImageUrls,
    }),
    [questionId, questionText, answerText, categories, questionImageUrls, answerImageUrls],
  );

  const askAi = useAskAi({ context, answerRevealed });

  if (askAi.isActive) {
    if (inline) {
      return (
        <div style={{ flexBasis: '100%', width: '100%' }}>
          <AskAiPanel state={askAi} />
        </div>
      );
    }
    return <AskAiPanel state={askAi} />;
  }

  if (inline) {
    return (
      <button
        type="button"
        className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
        onClick={() => askAi.actions.start()}
      >
        <Sparkles size={18} />
        Ask AI Tutor
      </button>
    );
  }

  return (
    <div className="text-center my-4">
      <button
        type="button"
        className={`${sharedStyles.actionButton} ${sharedStyles.btnCyan}`}
        onClick={() => askAi.actions.start()}
      >
        <Sparkles size={18} />
        Ask AI Tutor
      </button>
    </div>
  );
}