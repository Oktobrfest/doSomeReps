// Types matching what Flask sends down. Adjust field names to match your API.

export interface AudioAsset {
  url: string;
  lang: string;
}

export interface AudioAssets {
  question?: AudioAsset[];
  answer?: AudioAsset[];
}

export interface QuestionPics {
  question_image?: (string | null)[];
  answer_pics?: (string | null)[];
}

export interface Question {
  quizq_id: string | number;
  question_id: string | number;
  question_text: string;
  answer: string;
  level_no: number;
  categories: string[];
  pics: QuestionPics;
  created_by_username: string;
}

export interface AudioQuizProps {
  question: Question | null;
  audioAssets: AudioAssets | null;
  currentUsername: string;
  editQuestionUrl: string;
  csrfToken?: string;
}

// The state machine. One source of truth for what's visible.
export type QuizPhase =
  | 'idle'              // no audio active, answer hidden
  | 'question-playing'  // question audio sequence is playing
  | 'question-paused'   // question audio paused mid-sequence
  | 'answer-revealed'   // answer visible, no audio playing yet
  | 'answer-playing'    // answer audio sequence is playing
  | 'answer-paused';    // answer audio paused mid-sequence