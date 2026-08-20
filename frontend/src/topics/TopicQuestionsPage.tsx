import sharedStyles from "../styles/shared.module.css";
import { readTopicQuestionsBootstrap } from "./topics_api";
import styles from "./Topics.module.css";

const bootstrap = readTopicQuestionsBootstrap();

export function TopicQuestionsPage() {
  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>Questions for {bootstrap.topicName}</h2>

      {bootstrap.questions.length === 0 ? (
        <p className={styles.empty}>No questions found for this topic.</p>
      ) : (
        <div className={sharedStyles.tableResponsive}>
          <table className={styles.questionsTable}>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Answer</th>
                <th scope="col">Rating</th>
              </tr>
            </thead>
            <tbody>
              {bootstrap.questions.map((question) => (
                <tr key={question.id}>
                  <td>{question.questionText}</td>
                  <td>{question.answer}</td>
                  <td className={styles.ratingCell}>
                    {question.rating.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
