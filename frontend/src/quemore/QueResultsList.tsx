import { Ban, ListPlus, UserX } from "lucide-react";
import { RatingStars } from "../quiz/RatingStars";
import sharedStyles from "../styles/shared.module.css";
import styles from "./QueMore.module.css";
import { NO_SELECTION } from "./quemore_types";
import type { QueSearchResult, RowSelection } from "./quemore_types";

/** Class list for one control on a card: base + size + intent. */
function cardBtn(intent: string) {
  return `${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${intent}`;
}

interface QueResultsListProps {
  results: QueSearchResult[];
  selections: Record<number, RowSelection>;
  onToggle: (questionId: number, field: keyof RowSelection, value: boolean) => void;
  onBlock: (userId: number, username: string) => void;
  blockingUserId: number | null;
}

/**
 * One card per question found, rather than one row of a table nobody can read
 * on a phone: everything about a question stacks in a column narrow enough to
 * fit the screen it is on, and the two verdicts are buttons big enough for a
 * thumb instead of a pair of checkboxes.
 */
export function QueResultsList({
  results,
  selections,
  onToggle,
  onBlock,
  blockingUserId,
}: QueResultsListProps) {
  return (
    <ul className={styles.cardGrid}>
      {results.map((result) => {
        const selection = selections[result.question_id] ?? NO_SELECTION;
        const state = selection.que
          ? styles.cardQued
          : selection.exclude
            ? styles.cardExcluded
            : "";

        return (
          <li key={result.question_id} className={`${styles.card} ${state}`}>
            <p className={styles.cardQuestion}>{result.question_text}</p>

            {result.categories.length > 0 && (
              <div className={styles.categoryRow}>
                {result.categories.map((category) => (
                  <span key={category} className={styles.categoryChip}>
                    {category}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.cardMeta}>
              {result.rating === null ? (
                <span className={styles.unrated}>Unrated</span>
              ) : (
                <RatingStars
                  value={result.rating}
                  label={`Rated ${result.rating} out of 5`}
                />
              )}

              <div className={styles.byline}>
                <span className={styles.author}>by {result.username}</span>
                <button
                  type="button"
                  className={`${cardBtn(sharedStyles.btnRed)} ${sharedStyles.buttonRound}`}
                  onClick={() => onBlock(result.created_by, result.username)}
                  disabled={blockingUserId === result.created_by}
                  title={`Block ${result.username}`}
                  aria-label={`Block ${result.username}`}
                >
                  <UserX className={sharedStyles.buttonIcon} />
                </button>
              </div>
            </div>

            <div className={sharedStyles.actionRow}>
              <button
                type="button"
                aria-pressed={selection.que}
                className={cardBtn(
                  selection.que ? sharedStyles.btnCyan : sharedStyles.btnQuiet
                )}
                onClick={() =>
                  onToggle(result.question_id, "que", !selection.que)
                }
              >
                <ListPlus className={sharedStyles.buttonIcon} />
                <span>Que</span>
              </button>

              <button
                type="button"
                aria-pressed={selection.exclude}
                className={cardBtn(
                  selection.exclude ? sharedStyles.btnRed : sharedStyles.btnQuiet
                )}
                onClick={() =>
                  onToggle(result.question_id, "exclude", !selection.exclude)
                }
              >
                <Ban className={sharedStyles.buttonIcon} />
                <span>Exclude</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
