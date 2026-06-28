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

export interface QuizItem {
  question: Question | null;
  audioAssets: AudioAssets | null;
}

export interface AudioQuizBatchResponse {
  items: QuizItem[];
}

export interface AudioQuizProps {
  initialItems?: QuizItem[];
  currentUsername: string;
  editQuestionUrl: string;
  csrfToken?: string;
  /** Full display names of every available category. */
  categoryList?: string[];
  /** Pre-selected categories passed from the server, may be slugs or names. */
  selectedCategories?: string[];
}

export type CommandCallback = () => void;

export interface AudioCommandHandlers {
  correct: CommandCallback;
  wrong: CommandCallback;
  slightlyWrong: CommandCallback;
  getAnswer: CommandCallback;
  readQuestion: CommandCallback;
  pause: CommandCallback;
  resume: CommandCallback;
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
     * Still used as a coarse audio coordination bridge between quiz audio and
     * Ask AI playback. This is not used for quiz commands anymore.
     */
    __audioStopCallbacks?: Array<(() => void) | undefined>;
    __audioPlaying?: boolean;
  }
}