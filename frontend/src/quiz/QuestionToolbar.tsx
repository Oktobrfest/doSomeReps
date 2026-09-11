import { Ban, Edit, Lightbulb, Star } from 'lucide-react';
import { AuthorButton } from './AuthorButton';
import { RatingStars } from './RatingStars';
import { FlagButton, type QuestionFlag } from '../components/FlagButton';
import type { Question } from './types';
import sharedStyles from '../styles/shared.module.css';
import styles from './QuestionToolbar.module.css';

/** Class list for one control in the toolbar: base + size + intent. */
function toolbarBtn(intent: string) {
  return `${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${intent}`;
}

interface QuestionToolbarProps {
  question: Question;
  isOwnQuestion: boolean;
  editQuestionUrl: string;
  disabled: boolean;
  /** Absent when the question has nothing to hint at. */
  onHint?: () => void;
  /** Absent once the reader has rated the question. */
  onRate?: () => void;
  onExclude: () => void;
  onFlagChange: (flag: QuestionFlag | null) => void;
}

/**
 * Everything a reader can do about the question they are looking at, other than
 * answer it.
 *
 * A phone has no room for these beside the question and keeps them in the
 * slide-out panel; a full-sized page has room, so they sit with the level and
 * the categories they belong to and the panel is left holding the verdict.
 */
export function QuestionToolbar({
  question,
  isOwnQuestion,
  editQuestionUrl,
  disabled,
  onHint,
  onRate,
  onExclude,
  onFlagChange,
}: QuestionToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {onHint && (
        <button
          type="button"
          className={toolbarBtn(sharedStyles.btnCyan)}
          onClick={onHint}
          disabled={disabled}
        >
          <Lightbulb className={sharedStyles.buttonIcon} />
          <span>Hint</span>
        </button>
      )}

      <FlagButton
        questionId={question.question_id}
        initialFlag={question.flag}
        onFlagChange={onFlagChange}
        disabled={disabled}
        compact
      />

      <AuthorButton
        author={{
          id: question.created_by_id,
          username: question.created_by_username,
          isSelf: isOwnQuestion,
        }}
        disabled={disabled}
        className={toolbarBtn(sharedStyles.btnCyan)}
      />

      <button
        type="button"
        className={toolbarBtn(sharedStyles.btnRed)}
        onClick={onExclude}
        disabled={disabled}
      >
        <Ban className={sharedStyles.buttonIcon} />
        <span>Exclude</span>
      </button>

      {isOwnQuestion && (
        <a
          href={disabled ? undefined : `${editQuestionUrl}?q_id=${question.question_id}`}
          aria-disabled={disabled}
          className={toolbarBtn(sharedStyles.btnCyan)}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <Edit className={sharedStyles.buttonIcon} />
          <span>Edit Question</span>
        </a>
      )}

      <RatingStars
        value={question.rating}
        label={
          question.rating > 0
            ? `Rated ${question.rating.toFixed(1)} out of 5`
            : 'Not rated yet'
        }
      />

      {onRate && (
        <button
          type="button"
          className={toolbarBtn(sharedStyles.btnCyan)}
          onClick={onRate}
          disabled={disabled}
        >
          <Star className={sharedStyles.buttonIcon} />
          <span>Rate</span>
        </button>
      )}
    </div>
  );
}
