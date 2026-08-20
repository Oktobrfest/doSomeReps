import type { TopicListBootstrap, TopicQuestionsBootstrap } from "./topics_types";

function readBootstrap<T>(elementId: string, label: string): T {
  const node = document.getElementById(elementId);
  if (!node?.textContent) {
    throw new Error(`Missing ${label} bootstrap data.`);
  }
  return JSON.parse(node.textContent) as T;
}

export function readTopicListBootstrap(): TopicListBootstrap {
  return readBootstrap<TopicListBootstrap>("topic-list-data", "topic list");
}

export function readTopicQuestionsBootstrap(): TopicQuestionsBootstrap {
  return readBootstrap<TopicQuestionsBootstrap>(
    "topic-questions-data",
    "topic questions"
  );
}
