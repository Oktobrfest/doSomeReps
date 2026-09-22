/**
 * One question, as every page that writes one holds it.
 *
 * The add-content page, the AI question generator and the question editor all
 * edit this same draft; they differ only in where it comes from and where it
 * goes. A question is three parallel maps keyed by part - its text, the images
 * already stored for it, and the images picked but not yet uploaded - so the
 * editor never has to name question, hint and answer one at a time.
 */

export const QUESTION_PARTS = ["question", "hint", "answer"] as const;

export type QuestionPart = (typeof QUESTION_PARTS)[number];

export type ByPart<T> = Record<QuestionPart, T>;

/** An image already stored against the question. */
export interface PicData {
  pic_id: number;
  pic_string: string;
}

export interface QuestionDraft {
  text: ByPart<string>;
  /** Stored images. Dropping one here deletes it when the draft is saved. */
  pics: ByPart<PicData[]>;
  /** Images picked in the browser, uploaded with the next save. */
  files: ByPart<File[]>;
  categories: string[];
  privacy: boolean;
  autoQue: boolean;
  /** True when added manually in the browser rather than by the AI backend. */
  isLocal?: boolean;
}

export interface AudioAsset {
  audio_id: number;
  part: string;
  audio_text: string;
  public_url: string;
  language: string;
  object_key: string;
}

interface PartSpec {
  /** Label above the text field. */
  label: string;
  /** How the part is named in the image controls ("Add Answer Images"). */
  mediaLabel: string;
  rows: number;
  /** Matches the column width `question_service` enforces server-side. */
  maxLength: number;
  required: boolean;
}

export const QUESTION_PART_SPECS: ByPart<PartSpec> = {
  question: {
    label: "Question Text",
    mediaLabel: "Question",
    rows: 2,
    maxLength: 1500,
    required: true,
  },
  hint: {
    label: "Hint",
    mediaLabel: "Hint",
    rows: 2,
    maxLength: 2000,
    required: false,
  },
  answer: {
    label: "The Answer",
    mediaLabel: "Answer",
    rows: 4,
    maxLength: 4000,
    required: true,
  },
};

const byPart = <T,>(make: () => T): ByPart<T> => ({
  question: make(),
  hint: make(),
  answer: make(),
});

export function emptyDraft(): QuestionDraft {
  return {
    text: byPart(() => ""),
    pics: byPart<PicData[]>(() => []),
    files: byPart<File[]>(() => []),
    categories: [],
    privacy: false,
    autoQue: false,
  };
}

/** Whether the draft has enough in it for the server to accept it. */
export function draftError(draft: QuestionDraft): string | null {
  if (draft.categories.length === 0) return "Select at least one category.";
  if (draft.text.question.trim().length < 3) return "Question text is too short.";
  if (draft.text.answer.trim().length < 1) return "An answer is required.";
  return null;
}
