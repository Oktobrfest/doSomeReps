import type {
  GeneratedQuestion,
  GenerateQuestionsRequest,
  GeneratorMutationResponse,
  GeneratorStateResponse,
} from "./ai_question_generator_types";

const API_BASE = "/ai_question_generator/api";

interface ApiErrorResponse {
  error?: string;
}

async function requestJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    throw new Error("Server returned an invalid JSON response");
  }

  if (!response.ok) {
    const apiError = data as ApiErrorResponse;
    throw new Error(
      apiError.error || `Request failed with status ${response.status}`
    );
  }

  return data as T;
}

function postJson<TResponse>(
  path: string,
  body?: unknown
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function getGeneratorState(): Promise<GeneratorStateResponse> {
  return requestJson<GeneratorStateResponse>("/state");
}

export function generateQuestions(
  request: GenerateQuestionsRequest
): Promise<GeneratorMutationResponse> {
  if (request.file) {
    const formData = new FormData();
    formData.append("file", request.file);
    formData.append("categories", JSON.stringify(request.selectedCats));
    formData.append("qty_from", request.qtyFrom.toString());
    formData.append("qty_to", request.qtyTo.toString());
    formData.append("try_provide_hints", request.tryProvideHints.toString());
    formData.append("avoid_duplicates", request.avoidDuplicates.toString());

    return requestJson<GeneratorMutationResponse>("/generate", {
      method: "POST",
      body: formData,
    });
  }

  return postJson<GeneratorMutationResponse>("/generate", {
    quiz_content: request.quizContent,
    categories: request.selectedCats,
    qty_from: request.qtyFrom,
    qty_to: request.qtyTo,
    try_provide_hints: request.tryProvideHints,
    avoid_duplicates: request.avoidDuplicates,
  });
}

export function saveQuestion(
  index: number,
  question: GeneratedQuestion
): Promise<GeneratorMutationResponse> {
  return postJson<GeneratorMutationResponse>("/save", {
    index,
    question,
  });
}

export function deleteQuestion(
  index: number
): Promise<GeneratorMutationResponse> {
  return postJson<GeneratorMutationResponse>("/delete", { index });
}

export function extendQuestion(
  index: number,
  question: GeneratedQuestion,
  customInstructions: string,
  options: unknown
): Promise<GeneratorMutationResponse> {
  return postJson<GeneratorMutationResponse>("/extend", {
    index,
    question,
    custom_instructions: customInstructions,
    options,
  });
}

export function saveAllQuestions(
  questions: GeneratedQuestion[]
): Promise<GeneratorMutationResponse> {
  return postJson<GeneratorMutationResponse>("/save_all", { questions });
}

export function deleteAllQuestions(): Promise<GeneratorMutationResponse> {
  return postJson<GeneratorMutationResponse>("/delete_all");
}
