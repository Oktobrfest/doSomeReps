import { FlagCategory } from '../components/FlagConstants';

export interface AudioAsset {
  url: string;
  lang: string;
}

export interface AudioAssets {
  question?: AudioAsset[];
  answer?: AudioAsset[];
  hint?: AudioAsset[];
}

export interface QuestionPics {
  question_image?: (string | null)[];
  answer_pics?: (string | null)[];
  hint_image?: (string | null)[];
}

export interface QuestionFlag {
  category: FlagCategory;
  note: string | null;
}

export interface Question {
  quizq_id: string | number;
  question_id: string | number;
  question_text: string;
  hint: string | null;
  answer: string;
  level_no: number;
  categories: string[];
  pics: QuestionPics;
  created_by_id: number;
  created_by_username: string;
  /** Average rating across all users, 0 when nobody has rated it. */
  rating: number;
  /** What the current user rated this question, if anything. */
  user_rated: number | null;
  flag?: QuestionFlag | null;
}

export interface QuizItem {
  question: Question | null;
  audioAssets: AudioAssets | null;
}

export interface QuizBatchResponse {
  items: QuizItem[];
  queueExhausted?: boolean;
  message?: string;
}

export interface QuizPageProps {
  currentUsername: string;
  editQuestionUrl: string;
  csrfToken?: string;
  /** Full display names of every available category. */
  categoryList?: string[];
  /** Pre-selected categories passed from the server, may be slugs or names. */
  selectedCategories?: string[];
}

export type CommandCallback = () => void;

export interface QuizCommandHandlers {
  correct: CommandCallback;
  wrong: CommandCallback;
  slightlyWrong: CommandCallback;
  getAnswer: CommandCallback;
  readQuestion: CommandCallback;
  pause: CommandCallback;
  resume: CommandCallback;
  /** Triggered by the "ASK" voice command. The argument tells the handler
   *  whether command listening was active before Ask AI started, so it can
   *  request a resume when the user finishes. */
  askAi?: (wasListening: boolean) => void;
}

export type EngineState = 'idle' | 'loading' | 'listening' | 'error';

export interface SherpaStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  free(): void;
}

export interface SherpaKws {
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { keyword: string } | null;
  reset(stream: SherpaStream): void;
  free(): void;
}

declare global {
  interface Window {
    createKws?: (Module: any, config: any) => SherpaKws;
    Module?: any;

    /**
     * Coarse audio coordination bridge between quiz audio and
     * Ask AI playback.
     */
    __audioStopCallbacks?: Array<(() => void) | undefined>;
  }
}