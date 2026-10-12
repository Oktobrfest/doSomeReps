import { readBootstrap } from "../lib/bootstrap";
import type { TopicListBootstrap } from "./topics_types";

export function readTopicListBootstrap(): TopicListBootstrap {
  return readBootstrap<TopicListBootstrap>("topic-list-data", "topic list");
}
