import { createRoot } from "react-dom/client";
import { MarkdownContent } from "../components/MarkdownContent";

interface QuizMarkdownData {
  questionText?: string;
  hint?: string;
  answer?: string;
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
