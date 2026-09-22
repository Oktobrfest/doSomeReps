/**
 * The generator's own endpoints: producing a batch of questions and keeping it.
 *
 * Saving a generated question is not here - that goes through `createQuestion`,
 * the one route that writes a new question, whoever wrote it.
 */

import { csrfHeaders, jsonHeaders } from "../lib/http";
import { draftFromPayload, type QuestionPayload } from "../question/question_api";
import type { QuestionDraft } from "../question/question_types";

const API_BASE = "/ai_question_generator/api";

interface GeneratorResponse {
  success?: boolean;
  error?: string;
  generated_questions?: QuestionPayload[];
  selected_categories?: string[];
}

async function request(
  path: string,
  options?: RequestInit
): Promise<GeneratorResponse> {
  const response = await fetch(`${API_BASE}${path}`, options);

  let data: GeneratorResponse;
  try {
    data = (await response.json()) as GeneratorResponse;
  } catch {
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

const toDrafts = (data: GeneratorResponse): QuestionDraft[] =>
  (data.generated_questions ?? []).map(draftFromPayload);

export interface GeneratorState {
  drafts: QuestionDraft[];
  categories: string[];
}

export async function getGeneratorState(): Promise<GeneratorState> {
  const data = await request("/state");
  return { drafts: toDrafts(data), categories: data.selected_categories ?? [] };
}

export interface GenerateRequest {
  quizContent: string;
  file: File | null;
  categories: string[];
  qtyFrom: number;
  qtyTo: number;
  tryProvideHints: boolean;
  avoidDuplicates: boolean;
}

export async function generateQuestions(
  req: GenerateRequest
): Promise<QuestionDraft[]> {
  const fields = {
    quiz_content: req.quizContent,
    categories: req.categories,
    qty_from: req.qtyFrom,
    qty_to: req.qtyTo,
    try_provide_hints: req.tryProvideHints,
    avoid_duplicates: req.avoidDuplicates,
  };

  if (!req.file) {
    return toDrafts(
      await request("/generate", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(fields),
      })
    );
  }

  const body = new FormData();
  body.append("file", req.file);
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }

  return toDrafts(
    await request("/generate", { method: "POST", headers: csrfHeaders(), body })
  );
}

/** Drop one question from the working list. Saving it drops it too. */
export async function removeGenerated(index: number): Promise<void> {
  await request("/delete", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ index }),
  });
}

export async function clearGenerated(): Promise<void> {
  await request("/delete_all", { method: "POST", headers: jsonHeaders() });
}
