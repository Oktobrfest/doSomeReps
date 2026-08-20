export interface TopicSummary {
  name: string;
  questionCount: number;
  /** Server-built link to this topic's questions page. */
  url: string;
}

export interface TopicListBootstrap {
  topics: TopicSummary[];
}

export interface TopicQuestion {
  id: number;
  questionText: string;
  answer: string;
  /** Mean community rating; 0 when nobody has rated the question yet. */
  rating: number;
}

export interface TopicQuestionsBootstrap {
  topicName: string;
  questions: TopicQuestion[];
}

export type TopicSortColumn = "name" | "count";

export type SortDirection = "asc" | "desc";

export interface TopicSort {
  column: TopicSortColumn;
  direction: SortDirection;
}
