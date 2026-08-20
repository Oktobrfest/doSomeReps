import { TopicTable } from "./TopicTable";
import { readTopicListBootstrap } from "./topics_api";
import { useTopicSort } from "./useTopicSort";
import styles from "./Topics.module.css";

const bootstrap = readTopicListBootstrap();

export function TopicListPage() {
  const { sorted, sort, toggle } = useTopicSort(bootstrap.topics);

  const midpoint = Math.ceil(sorted.length / 2);
  const halves = [sorted.slice(0, midpoint), sorted.slice(midpoint)].filter(
    (half) => half.length > 0
  );

  return (
    <div className={styles.page}>
      {halves.length === 0 ? (
        <p className={styles.empty}>No topics yet.</p>
      ) : (
        <div className={styles.topicColumns}>
          {halves.map((half) => (
            <div className={styles.topicColumn} key={half[0].name}>
              <TopicTable topics={half} sort={sort} onSort={toggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
