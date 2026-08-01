import { createRoot } from "react-dom/client";
import { useState } from "react";
import { MarkdownContent } from "../components/MarkdownContent";
import { FlagButton, type QuestionFlag } from "../components/FlagButton";

interface QuizMarkdownData {
  questionText?: string;
  hint?: string;
  answer?: string;
  questionId?: string | number;
  initialFlag?: QuestionFlag | null;
  csrfToken?: string;
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
