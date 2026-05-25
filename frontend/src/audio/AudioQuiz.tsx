import { useState, useCallback, useMemo } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import {
  Volume2,
  BookOpen,
  Check,
  X,
  Ban,
} from 'lucide-react';
import type { AudioQuizProps, QuizPhase } from './types';

export function AudioQuiz({
  question,
  audioAssets,
  currentUsername,
  editQuestionUrl,
  csrfToken,
}: AudioQuizProps) {
  const [phase, setPhase] = useState<QuizPhase>('idle');

  const questionAssets = useMemo(() => audioAssets?.question ?? [], [audioAssets]);
  const answerAssets = useMemo(() => audioAssets?.answer ?? [], [audioAssets]);

  // ── Derived booleans (single source of truth) ──
  const answerRevealed =
    phase === 'answer-revealed' ||
    phase === 'answer-playing' ||
    phase === 'answer-paused';

  const questionAudioActive =
    phase === 'question-playing' || phase === 'question-paused';

  const answerAudioActive =
    phase === 'answer-playing' || phase === 'answer-paused';

  // ── Actions ──
  const handleReadQuestion = useCallback(() => {
    if (phase === 'question-playing') setPhase('question-paused');
    else if (phase === 'question-paused') setPhase('question-playing');
    else setPhase('question-playing');
  }, [phase]);

  const handleQuestionToggle = useCallback(() => {
    setPhase((p) => (p === 'question-playing' ? 'question-paused' : 'question-playing'));
  }, []);

  const handleQuestionEnded = useCallback(() => {
    // Sequence done — back to idle. The Get Answer button stays visible because
    // it's derived from `answerRevealed`, not from phase.
    setPhase('idle');
  }, []);

  const handleGetAnswer = useCallback(() => {
    if (answerAssets.length > 0) setPhase('answer-playing');
    else setPhase('answer-revealed');
  }, [answerAssets.length]);

  const handleAnswerToggle = useCallback(() => {
    setPhase((p) => (p === 'answer-playing' ? 'answer-paused' : 'answer-playing'));
  }, []);

  const handleAnswerEnded = useCallback(() => setPhase('answer-revealed'), []);

  // ── No question — Start button only ──
  if (!question) {
    return (
      <form method="post" className="flex flex-col items-center py-12">
        {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}
        <Button
          type="submit"
          name="start-quiz"
          size="lg"
          className="h-auto rounded-2xl bg-green-600 px-16 py-8 text-3xl font-bold shadow-lg hover:bg-green-700"
        >
          Start!
        </Button>
      </form>
    );
  }

  return (
    <form method="post" className="flex flex-col gap-2">
      {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}
      <input type="hidden" name="quizq-id" value={question.quizq_id} />

      {/* ═══════════════════════════════════════════════════════
          ACTION BUTTONS
          ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-2 py-2">
        {/* Voice command root (your existing widget mounts elsewhere) */}
        <div id="audio-command-root" className="w-full" />

        {/* Question images */}
        {question.pics.question_image?.map((pic, i) =>
          pic ? (
            <div key={i} className="mb-2 w-full text-center">
              <img
                src={pic}
                alt="Question"
                className="mx-auto max-h-72 object-contain"
              />
            </div>
          ) : null
        )}

        {/* ── Read Question button ──
            Uses asChild + a div internally because the AudioPlayer needs vertical
            stacking when active. Disabled when there's no audio. */}
        <Button
          type="button"
          onClick={handleReadQuestion}
          disabled={questionAssets.length === 0}
          size="lg"
          className={`h-auto w-full rounded-xl bg-blue-600 text-xl font-bold text-white shadow hover:bg-blue-700 ${
            questionAudioActive
              ? 'flex-col gap-1 px-5 py-2.5'
              : 'min-h-16 gap-2 px-5 py-3'
          }`}
        >
          {!questionAudioActive && (
            <>
              <Volume2 className="size-5" />
              Read Question
            </>
          )}
          {questionAudioActive && (
            <AudioPlayer
              assets={questionAssets}
              isPlaying={phase === 'question-playing'}
              onSequenceEnd={handleQuestionEnded}
              onTogglePause={handleQuestionToggle}
            />
          )}
        </Button>

        {/* ── Middle slot: Get Answer ↔ Correct/Wrong ── */}
        <div className="flex flex-col gap-2">
          {/* Answer images (only after reveal) */}
          {answerRevealed && question.pics.answer_pics?.some(Boolean) && (
            <div className="w-full text-center">
              {question.pics.answer_pics?.map((pic, i) =>
                pic ? (
                  <img
                    key={i}
                    src={pic}
                    alt="Answer"
                    className="mx-auto mb-2 max-h-72 object-contain"
                  />
                ) : null
              )}
            </div>
          )}

          {/* Get Answer — visible while answer not yet revealed.
              This does NOT depend on question-audio state. That's the fix. */}
          {!answerRevealed && (
            <Button
              type="button"
              onClick={handleGetAnswer}
              size="lg"
              className="h-auto min-h-16 w-full gap-2 rounded-xl bg-yellow-500 px-5 py-3 text-xl font-bold text-white shadow hover:bg-yellow-600"
            >
              <BookOpen className="size-5" />
              Get Answer
            </Button>
          )}

          {/* Answer audio player */}
          {answerAudioActive && (
            <Button
              type="button"
              onClick={handleAnswerToggle}
              size="lg"
              className="h-auto w-full flex-col gap-1 rounded-xl bg-cyan-600 px-5 py-2.5 text-xl font-bold text-white shadow hover:bg-cyan-700"
            >
              <AudioPlayer
                assets={answerAssets}
                isPlaying={phase === 'answer-playing'}
                onSequenceEnd={handleAnswerEnded}
                onTogglePause={handleAnswerToggle}
              />
            </Button>
          )}

          {/* Correct + Wrong */}
          {answerRevealed && (
            <div className="flex w-full gap-2">
              <Button
                type="submit"
                name="correct_submit"
                value="Correct!"
                size="lg"
                className="h-auto min-h-16 flex-1 gap-2 rounded-xl bg-green-600 px-5 py-3 text-xl font-bold text-white shadow hover:bg-green-700"
              >
                <Check className="size-5" />
                Correct!
              </Button>
              <Button
                type="submit"
                name="incorrect_submit"
                value="Wrong!"
                size="lg"
                className="h-auto min-h-16 flex-1 gap-2 rounded-xl bg-red-600 px-5 py-3 text-xl font-bold text-white shadow hover:bg-red-700"
              >
                <X className="size-5" />
                Wrong!
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          QUESTION CONTENT
          ═══════════════════════════════════════════════════════ */}
      <div className="border-t-2 border-border pb-8 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <strong>Level {question.level_no}</strong>
          {question.categories.map((cat) => (
            <Badge key={cat} variant="secondary">{cat}</Badge>
          ))}
        </div>

        <p className="mb-2 text-lg leading-relaxed">{question.question_text}</p>

        {answerRevealed && (
          <Card className="mt-4 rounded-md border-l-4 border-l-green-600 bg-muted p-4">
            <h5 className="mb-2 flex items-center gap-2 font-semibold text-green-800">
              <BookOpen className="size-5" />
              The Answer
            </h5>
            <pre className="m-0 whitespace-pre-wrap font-sans text-lg leading-relaxed">
              {question.answer}
            </pre>
          </Card>
        )}
      </div>

      {/* Admin actions */}
      <div className="mb-3 mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="submit"
          name="exclude-question-button"
          value="exclude"
          variant="secondary"
          className="gap-2 font-bold"
        >
          <Ban className="size-4" />
          Exclude
        </Button>

        {question.created_by_username === currentUsername && (
          <Button asChild variant="secondary" className="font-bold">
            <a href={`${editQuestionUrl}?q_id=${question.question_id}`}>
              Edit Question
            </a>
          </Button>
        )}
      </div>
    </form>
  );
}