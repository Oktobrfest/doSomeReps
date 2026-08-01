import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAskAi } from './useAskAi';
import { AskAiPanel } from './AskAiPanel';
import type { AskAiContext } from './types';

export interface AskAiLauncherProps {
  questionId: string | number;
  questionText: string;
  answerText?: string;
  answerRevealed?: boolean;
  categories?: string[];
  questionImageUrls?: string[];
  answerImageUrls?: string[];
  csrfToken?: string;
}

export function AskAiLauncher({
  questionId,
  questionText,
  answerText,
  answerRevealed = false,
  categories,
  questionImageUrls,
  answerImageUrls,
  csrfToken,
}: AskAiLauncherProps) {
  const context = useMemo<AskAiContext>(
    () => ({
      questionId,
      questionText,
      answerText,
      categories,
      questionImageUrls,
      answerImageUrls,
      csrfToken,
    }),
    [questionId, questionText, answerText, categories, questionImageUrls, answerImageUrls, csrfToken],
  );

  const askAi = useAskAi({ context, answerRevealed });

  if (askAi.isActive) {
    return <AskAiPanel state={askAi} />;
  }

  return (
    <div className="text-center my-4">
      <button
        type="button"
        className="btn btn-info btn-lg font-weight-bold"
        onClick={() => askAi.actions.start()}
      >
        <Sparkles size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Ask AI Tutor
      </button>
    </div>
  );
}