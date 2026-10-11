export interface TopicSummary {
  name: string;
  questionCount: number;
  /** Server-built link to this topic's questions page. */
  url: string;
}

export interface TopicListBootstrap {
  topics: TopicSummary[];
}

export interface TopicQuestionsBootstrap {
  topicName: string;
  /** Server-built link back to the list of every topic. */
  topicListUrl: string;
}

export type TopicSortColumn = "name" | "count";

export type SortDirection = "asc" | "desc";

export interface TopicSort {
  column: TopicSortColumn;
  direction: SortDirection;
}
