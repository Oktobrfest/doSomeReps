export interface HomeUser {
  id: number;
  username: string;
}

export interface DailyQuizStat {
  date: string;
  correct: Record<string, number>;
  incorrect: Record<string, number>;
  totalCorrect: number;
  totalIncorrect: number;
}

export interface HomeBootstrap {
  favorites: HomeUser[];
  blocked: HomeUser[];
  quizQuestionCount: number;
  quizUrl: string;
  /** Base64-encoded PNG of the "categories to do" chart, rendered server-side. */
  catzChart: string;
  dailyHistory?: DailyQuizStat[];
  unfavoriteUrl: string;
  unblockUrl: string;
}
