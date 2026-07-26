import type {
  ExtendQuestionInput,
  ExtendQuestionResponse,
  QuestionData,
  SaveQuestionInput,
} from "./question_editor_types";

async function getErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        return text;
      }
    }
  } catch {
    // Fall through to the caller-provided message.
  }

  return fallbackMessage;
}

export async function getQuestion(questionId: number): Promise<QuestionData> {
  const response = await fetch("/getq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(questionId),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Failed to load question details.")
    );
  }

  return response.json() as Promise<QuestionData>;
}

export async function deleteAudio(audioId: number): Promise<void> {
  const response = await fetch("/delete_audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_id: audioId }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Failed to delete audio asset.")
    );
  }
}

export async function deleteQuestion(questionId: number): Promise<void> {
  const response = await fetch("/deleteq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: questionId }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Failed to delete the question.")
    );
  }
}

export async function extendQuestion({
  questionId,
  questionText,
  hintText,
  answerText,
  categories,
  customInstructions,
  selectedOptions,
}: ExtendQuestionInput): Promise<ExtendQuestionResponse> {
  const response = await fetch("/ai_question_generator/api/extend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question_id: questionId,
      question: {
        question: questionText,
        hint: hintText,
        answer: answerText,
        categories,
      },
      custom_instructions: customInstructions,
      options: selectedOptions,
    }),
  });

  let data: ExtendQuestionResponse;

  try {
    data = (await response.json()) as ExtendQuestionResponse;
  } catch {
    throw new Error(
      await getErrorMessage(response, "Extend failed")
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Extend failed");
  }

  return data;
}

export async function saveQuestion({
  payload,
  questionFiles,
  hintFiles,
  answerFiles,
}: SaveQuestionInput): Promise<void> {
  const formData = new FormData();
  formData.append("updated_question", JSON.stringify(payload));

  questionFiles.forEach((file) => {
    formData.append("question_image", file);
  });

  hintFiles.forEach((file) => {
    formData.append("hint_image", file);
  });

  answerFiles.forEach((file) => {
    formData.append("answer_pics", file);
  });

  const response = await fetch("/saveq", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Failed to save the question.")
    );
  }
}
