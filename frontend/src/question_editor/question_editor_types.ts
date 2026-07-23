export interface PicData {
  pic_string: string;
  pic_id: number;
}

export interface PicsByType {
  hint: PicData[];
  answer: PicData[];
  question: PicData[];
}

export interface AudioData {
  audio_id: number;
  part: string;
  audio_text: string;
  public_url: string;
  language: string;
  object_key: string;
}

export interface QuestionData {
  id: number;
  question_text: string;
  hint: string;
  answer: string;
  privacy: boolean;
  categories: string[];
  pics_by_type: PicsByType;
  audio_files?: AudioData[];
}

export interface QuestionEditorProps {
  questionId: number | null;
  onDeleted?: () => void;
  onSaved?: () => void;
  onClose?: () => void;
}

export interface QuestionUpdatePayload {
  id: number;
  question_text: string;
  hint: string;
  answer: string;
  privacy: boolean;
  categories: string[];
  pics_by_type: {
    hint: string[];
    answer: string[];
    question: string[];
  };
}

export interface SaveQuestionInput {
  payload: QuestionUpdatePayload;
  questionFiles: File[];
  hintFiles: File[];
  answerFiles: File[];
}

export interface ExtendQuestionInput {
  questionId: number;
  questionText: string;
  hintText: string;
  answerText: string;
  categories: string[];
  customInstructions: string;
  selectedOptions: unknown;
}

export interface ExtendQuestionResponse {
  success: boolean;
  error?: string;
  question?: {
    answer?: string;
    hint?: string;
  };
}
