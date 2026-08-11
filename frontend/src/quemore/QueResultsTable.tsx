import sharedStyles from "../styles/shared.module.css";
import styles from "./QueMore.module.css";
import type { QueSearchResult, RowSelection } from "./quemore_types";

interface QueResultsTableProps {
  results: QueSearchResult[];
  selections: Record<number, RowSelection>;
  onToggle: (questionId: number, field: keyof RowSelection, value: boolean) => void;
  onBlock: (userId: number, username: string) => void;
  blockingUserId: number | null;
}

export function QueResultsTable({
  results,
  selections,
  onToggle,
  onBlock,
  blockingUserId,
}: QueResultsTableProps) {
  return (
    <div className={sharedStyles.tableResponsive}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Que</th>
            <th scope="col">Exclude</th>
            <th scope="col">Username</th>
            <th scope="col">Rating</th>
            <th scope="col">Question</th>
            <th scope="col">Categories</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const selection = selections[result.question_id] ?? {
              que: false,
              exclude: false,
            };

            return (
              <tr key={result.question_id}>
                <td className={styles.checkCell}>
                  <input
                    type="checkbox"
                    checked={selection.que}
                    aria-label={`Add question ${result.question_id} to your que`}
                    onChange={(event) =>
                      onToggle(result.question_id, "que", event.target.checked)
                    }
                  />
                </td>
                <td className={styles.checkCell}>
                  <input
                    type="checkbox"
                    checked={selection.exclude}
                    aria-label={`Exclude question ${result.question_id}`}
                    onChange={(event) =>
                      onToggle(result.question_id, "exclude", event.target.checked)
                    }
                  />
                </td>
                <td>
                  <div className={styles.userCell}>
                    <span>{result.username}</span>
                    <button
                      type="button"
                      className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnRed}`}
                      onClick={() => onBlock(result.created_by, result.username)}
                      disabled={blockingUserId === result.created_by}
                    >
                      Block
                    </button>
                  </div>
                </td>
                <td className={styles.ratingCell}>{result.rating ?? "—"}</td>
                <td className={styles.questionCell}>{result.question_text}</td>
                <td>
                  <div className={styles.categoryCell}>
                    {result.categories.map((category) => (
                      <span key={category} className={styles.categoryBadge}>
                        {category}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
