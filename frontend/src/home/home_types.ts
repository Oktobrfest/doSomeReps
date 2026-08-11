export interface HomeUser {
  id: number;
  username: string;
}

export interface HomeBootstrap {
  favorites: HomeUser[];
  blocked: HomeUser[];
  quizQuestionCount: number;
  quizUrl: string;
  /** Base64-encoded PNG of the "categories to do" chart, rendered server-side. */
  catzChart: string;
  unfavoriteUrl: string;
  unblockUrl: string;
}
