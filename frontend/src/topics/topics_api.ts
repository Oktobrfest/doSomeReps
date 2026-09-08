import { readBootstrap } from "../lib/bootstrap";
import type { TopicListBootstrap, TopicQuestionsBootstrap } from "./topics_types";

export function readTopicListBootstrap(): TopicListBootstrap {
  return readBootstrap<TopicListBootstrap>("topic-list-data", "topic list");
}

export function readTopicQuestionsBootstrap(): TopicQuestionsBootstrap {
  return readBootstrap<TopicQuestionsBootstrap>(
    "topic-questions-data",
    "topic questions"
  );
}
