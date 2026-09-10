import { TopicGrid } from "./TopicGrid";
import { TopicToolbar } from "./TopicToolbar";
import { readTopicListBootstrap } from "./topics_api";
import { useTopicView } from "./useTopicView";
import styles from "./Topics.module.css";

const bootstrap = readTopicListBootstrap();

const totalQuestions = bootstrap.topics.reduce(
  (total, topic) => total + topic.questionCount,
  0
);

const largest = Math.max(0, ...bootstrap.topics.map((topic) => topic.questionCount));

export function TopicListPage() {
  const { visible, sort, toggleSort, query, setQuery } = useTopicView(
    bootstrap.topics
  );

  const filtering = query.trim().length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Topics</h1>
        <p className={styles.pageSummary}>
          {filtering
            ? `${visible.length} of ${bootstrap.topics.length} topics`
            : `${bootstrap.topics.length} topics; ${totalQuestions.toLocaleString()} questions`}
        </p>
      </header>

      <TopicToolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSort={toggleSort}
      />

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {filtering ? "No topics match that filter." : "No topics yet."}
        </p>
      ) : (
        <TopicGrid topics={visible} largest={largest} />
      )}
    </div>
  );
}
