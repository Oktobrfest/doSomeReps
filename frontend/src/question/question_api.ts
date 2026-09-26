/**
 * Every request that reads or writes a question.
 *
 * One module so the wire format - snake_case fields, the three image upload
 * fields, the extend contract - is written down once and no page can drift.
 */

import { csrfHeaders, jsonHeaders } from "../lib/http";
import {
  QUESTION_PARTS,
  emptyDraft,
  type AudioAsset,
  type ByPart,
  type PicData,
  type QuestionDraft,
} from "./question_types";

/** The multipart field `save_pictures` reads each part's uploads from. */
const UPLOAD_FIELD: ByPart<string> = {
  question: "question_image",
  hint: "hint_image",
  answer: "answer_pics",
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    // A non-JSON body tells us nothing the fallback does not.
  }
  return fallback;
}

async function expectOk(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) throw new Error(await readError(response, fallback));
  return response.json();
}

/** The draft as `question_service.QuestionDraft.from_payload` reads it. */
function toFormData(draft: QuestionDraft, id?: number): FormData {
  const body = new FormData();

  body.append(
    "question",
    JSON.stringify({
      id,
      question_text: draft.text.question,
      hint: draft.text.hint,
      answer: draft.text.answer,
      categories: draft.categories,
      privacy: draft.privacy,
      auto_que: draft.autoQue,
      // The images kept; anything missing here is deleted server-side.
      pics_by_type: Object.fromEntries(
        QUESTION_PARTS.map((part) => [
          part,
          draft.pics[part].map((pic) => pic.pic_string),
        ])
      ),
    })
  );

  for (const part of QUESTION_PARTS) {
    for (const file of draft.files[part]) {
      body.append(UPLOAD_FIELD[part], file);
    }
  }

  return body;
}

async function post(url: string, draft: QuestionDraft, id?: number) {
  const response = await fetch(url, {
    method: "POST",
    headers: csrfHeaders(),
    body: toFormData(draft, id),
  });
  return (await expectOk(response, "Could not save the question.")) as {
    id: number;
  };
}

export async function createQuestion(draft: QuestionDraft): Promise<number> {
  const { id } = await post("/addq", draft);
  return id;
}

export async function updateQuestion(
  id: number,
  draft: QuestionDraft
): Promise<void> {
  await post("/saveq", draft, id);
}

/** The wire shape of a question, as every endpoint that returns one sends it. */
export interface QuestionPayload {
  question_text?: string;
  hint?: string | null;
  answer?: string;
  categories?: string[];
  privacy?: boolean;
  auto_que?: boolean;
  pics_by_type?: Partial<ByPart<PicData[]>>;
}

export function draftFromPayload(payload: QuestionPayload): QuestionDraft {
  const empty = emptyDraft();
  return {
    ...empty,
    text: {
      question: payload.question_text ?? "",
      hint: payload.hint ?? "",
      answer: payload.answer ?? "",
    },
    pics: { ...empty.pics, ...payload.pics_by_type },
    categories: payload.categories ?? [],
    privacy: Boolean(payload.privacy),
    autoQue: Boolean(payload.auto_que),
  };
}

export interface LoadedQuestion {
  draft: QuestionDraft;
  audio: AudioAsset[];
}

export async function loadQuestion(id: number): Promise<LoadedQuestion> {
  const response = await fetch("/getq", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(id),
  });

  const data = (await expectOk(
    response,
    "Failed to load question details."
  )) as QuestionPayload & { audio_files?: AudioAsset[] };

  return { draft: draftFromPayload(data), audio: data.audio_files ?? [] };
}

export async function deleteQuestion(id: number): Promise<void> {
  const response = await fetch("/deleteq", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to delete the question."));
  }
}

export async function deleteAudio(audioId: number): Promise<void> {
  const response = await fetch("/delete_audio", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ audio_id: audioId }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to delete audio asset."));
  }
}

/**
 * Where an extended answer is kept.
 *
 * A generated question still in the working list is addressed by `index`, one
 * already in the database by `questionId`, and one being written by neither.
 */
export type ExtendTarget =
  | { index: number }
  | { questionId: number }
  | Record<string, never>;

export interface ExtendedQuestion {
  /** The question's text as the AI left it. */
  text: QuestionDraft["text"];
  /** The AI's note to whoever is editing, or null when it has none. */
  messageToEditor: string | null;
}

export async function extendQuestion(
  target: ExtendTarget,
  draft: QuestionDraft,
  customInstructions: string,
  options: string[],
  signal: AbortSignal
): Promise<ExtendedQuestion> {
  const response = await fetch("/ai_question_generator/api/extend", {
    method: "POST",
    headers: jsonHeaders(),
    signal,
    body: JSON.stringify({
      index: "index" in target ? target.index : undefined,
      question_id: "questionId" in target ? target.questionId : undefined,
      question: {
        question_text: draft.text.question,
        hint: draft.text.hint,
        answer: draft.text.answer,
        categories: draft.categories,
        privacy: draft.privacy,
        auto_que: draft.autoQue,
      },
      custom_instructions: customInstructions,
      options,
    }),
  });

  const data = (await expectOk(response, "Extend failed")) as {
    question: QuestionPayload;
    message_to_editor: string | null;
  };

  return {
    text: draftFromPayload(data.question).text,
    messageToEditor: data.message_to_editor,
  };
}
