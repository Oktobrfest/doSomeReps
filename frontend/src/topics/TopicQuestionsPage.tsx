import sharedStyles from "../styles/shared.module.css";
import { readTopicQuestionsBootstrap } from "./topics_api";
import styles from "./Topics.module.css";

const bootstrap = readTopicQuestionsBootstrap();

/** Scaffolding: the topic's questions come back here on the Que More cards. */
export function TopicQuestionsPage() {
  return (
    <div className={styles.page}>
      <nav aria-label="Topics">
        <a
          href={bootstrap.topicListUrl}
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
        >
          All Topics
        </a>
      </nav>

      <h1 className={styles.pageTitle}>Questions for {bootstrap.topicName}</h1>
    </div>
  );
}
