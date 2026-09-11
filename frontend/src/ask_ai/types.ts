import type { AudioAsset } from '../quiz/types';

export type { AudioAsset };

export interface AskAiContext {
  questionId: string | number;
  questionText: string;
  answerText?: string;
  categories?: string[];
  questionImageUrls?: string[];
  answerImageUrls?: string[];
}

export interface AskAiTurn {
  id: string;
  transcript: string;
  answer: string;
  audioAssets: AudioAsset[];
  audioPlaying: boolean;
}

export interface AskAiState {
  isActive: boolean;
  isRecording: boolean;
  phase: string | null;
  transcript: string | null;
  error: string | null;
  history: AskAiTurn[];
  availableImageCount: number;
  includeImages: boolean;
  actions: {
    start: (wasListening?: boolean) => Promise<void>;
    stopAndSend: () => void;
    cancel: () => void;
    cancelSession: () => void;
    toggleHistoryAudio: (id: string) => void;
    historyPlaybackEnded: (id: string) => void;
    discardTurn: (id: string) => void;
    setIncludeImages: (next: boolean) => void;
  };
}