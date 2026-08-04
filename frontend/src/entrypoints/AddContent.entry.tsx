import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AskAiLauncher } from "../ask_ai/AskAiLauncher";
import "../styles/global.css";

function useFieldValue(selector: string): string {
  const [value, setValue] = useState("");

  useEffect(() => {
    const el = document.querySelector<HTMLTextAreaElement>(selector);
    if (!el) return;
    const sync = () => setValue(el.value);
    sync();
    el.addEventListener("input", sync);
    return () => el.removeEventListener("input", sync);
  }, [selector]);

  return value;
}

function useFileDataUrls(selector: string): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (!el) return;

    const onChange = () => {
      const files = Array.from(el.files ?? []);
      Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            })
        )
      )
        .then((results) => setUrls(results.filter((u) => u.startsWith("data:image/"))))
        .catch(() => setUrls([]));
    };

    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [selector]);

  return urls;
}

function AddContentAskAi() {
  const questionText = useFieldValue("#question_text");
  const answerText = useFieldValue("#answer");
  const questionImageUrls = useFileDataUrls('input[name="question_image"]');
  const answerImageUrls = useFileDataUrls('input[name="answer_pics"]');

  return (
    <AskAiLauncher
      questionId="new"
      questionText={questionText}
      answerText={answerText}
      answerRevealed={true}
      questionImageUrls={questionImageUrls}
      answerImageUrls={answerImageUrls}
    />
  );
}

const el = document.getElementById("ask-ai-launcher-root");
if (el) {
  createRoot(el).render(<AddContentAskAi />);
}
