import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import { MarkdownContent } from "../components/MarkdownContent";
import { FlagButton, type QuestionFlag } from "../components/FlagButton";
import { AskAiLauncher } from "../ask_ai/AskAiLauncher";
import "../styles/global.css";

interface QuizMarkdownData {
  questionText?: string;
  hint?: string;
  answer?: string;
  questionId?: string | number;
  initialFlag?: QuestionFlag | null;
  csrfToken?: string;
  categories?: string[];
  pics?: {
    question_image?: (string | null)[];
    answer_pics?: (string | null)[];
    hint_image?: (string | null)[];
  };
}

function getMarkdownData(): QuizMarkdownData {
  const el = document.getElementById("quiz-markdown-data");
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || "{}");
  } catch (e) {
    console.error("Failed to parse markdown data:", e);
    return {};
  }
}

const data = getMarkdownData();

const mounts: [string, string | undefined][] = [
  ["q-question-text", data.questionText],
  ["q-hint-reveal-text", data.hint],
  ["q-answer-reveal-text", data.answer],
];

for (const [id, content] of mounts) {
  const el = document.getElementById(id);
  if (el && content != null && content !== "") {
    createRoot(el).render(<MarkdownContent content={content} />);
  }
}

function QuizFlagWrapper({
  questionId,
  initialFlag,
  csrfToken,
}: {
  questionId: string | number;
  initialFlag?: QuestionFlag | null;
  csrfToken?: string;
}) {
  const [flag, setFlag] = useState<QuestionFlag | null>(initialFlag || null);

  return (
    <FlagButton
      questionId={questionId}
      initialFlag={flag}
      csrfToken={csrfToken}
      onFlagChange={setFlag}
      compact={true}
    />
  );
}

const flagEl = document.getElementById("q-flag-button-container");
if (flagEl && data.questionId != null) {
  createRoot(flagEl).render(
    <QuizFlagWrapper
      questionId={data.questionId}
      initialFlag={data.initialFlag}
      csrfToken={data.csrfToken}
    />
  );
}

function nonEmpty(list?: (string | null)[]): string[] {
  return (list ?? []).filter((s): s is string => !!s);
}

function QuizAskAiMount() {
  const [answerRevealed, setAnswerRevealed] = useState(false);

  useEffect(() => {
    const btn = document.getElementById("answer-submit-btn");
    if (!btn) return;
    const onClick = () => setAnswerRevealed(true);
    btn.addEventListener("click", onClick, { once: true });
    return () => btn.removeEventListener("click", onClick);
  }, []);

  return (
    <AskAiLauncher
      questionId={data.questionId!}
      questionText={data.questionText || ""}
      answerText={data.answer}
      answerRevealed={answerRevealed}
      categories={data.categories}
      questionImageUrls={nonEmpty(data.pics?.question_image)}
      answerImageUrls={nonEmpty(data.pics?.answer_pics)}
      csrfToken={data.csrfToken}
    />
  );
}

const askAiEl = document.getElementById("ask-ai-launcher-root");
if (askAiEl && data.questionId != null) {
  createRoot(askAiEl).render(<QuizAskAiMount />);
}