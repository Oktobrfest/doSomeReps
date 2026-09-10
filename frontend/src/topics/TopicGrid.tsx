import type { CSSProperties } from "react";
import styles from "./Topics.module.css";
import type { TopicSummary } from "./topics_types";

/** How long a topic's bar is drawn: its share of the biggest topic there is. */
function share(questionCount: number, largest: number): CSSProperties {
  const percent = largest > 0 ? (questionCount / largest) * 100 : 0;
  return { "--topic-share": `${percent}%` } as CSSProperties;
}

interface TopicGridProps {
  topics: TopicSummary[];
  /** Measured against the whole list, so filtering never rescales the bars. */
  largest: number;
}

/**
 * One card per topic rather than two half-tables of pills: the card is the link,
 * so the whole of it is a target a thumb can hit, and the bar under the count
 * says how big a topic is relative to the biggest without reading any numbers.
 */
export function TopicGrid({ topics, largest }: TopicGridProps) {
  return (
    <ul className={styles.topicGrid}>
      {topics.map((topic) => (
        <li key={topic.name}>
          <a className={styles.topicCard} href={topic.url}>
            <span className={styles.topicName}>{topic.name}</span>
            <span className={styles.topicCount}>
              {topic.questionCount}{" "}
              {topic.questionCount === 1 ? "question" : "questions"}
            </span>
            <span
              className={styles.topicBar}
              style={share(topic.questionCount, largest)}
              aria-hidden="true"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
