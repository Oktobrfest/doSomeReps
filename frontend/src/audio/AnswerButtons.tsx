import { Check, X, Minus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import actionStyles from './ActionButton.module.css';
import styles from './AnswerButtons.module.css';

interface AnswerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'correct' | 'wrong' | 'slightlyWrong';
}

function AnswerButton({ variant, className, children, ...props }: AnswerButtonProps) {
  const variantClass =
    variant === 'correct'
      ? actionStyles.greenBtn
      : variant === 'wrong'
        ? actionStyles.redBtn
        : actionStyles.orangeBtn;

  return (
    <button
      type="button"
      className={`${styles.btn} ${variantClass} ${className || ''}`}
      {...props}
    >
      {variant === 'correct' && <Check className={styles.icon} />}
      {variant === 'wrong' && <X className={styles.icon} />}
      {variant === 'slightlyWrong' && <Minus className={styles.icon} />}
      <span>{children}</span>
    </button>
  );
}

export interface AnswerButtonsProps {
  className?: string;
  size?: 'default' | 'compact';
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
}

export function AnswerButtons({
  className,
  size = 'default',
  onCorrect,
  onWrong,
  onSlightlyWrong,
}: AnswerButtonsProps) {
  return (
    <div
      className={`${styles.container} ${size === 'compact' ? styles.sizeCompact : ''} ${className || ''}`}
    >
      {onCorrect && (
        <AnswerButton variant="correct" onClick={onCorrect} className={styles.correct}>
          Correct!
        </AnswerButton>
      )}
      {onWrong && (
        <AnswerButton variant="wrong" onClick={onWrong} className={styles.secondary}>
          Wrong!
        </AnswerButton>
      )}
      {onSlightlyWrong && (
        <AnswerButton
          variant="slightlyWrong"
          onClick={onSlightlyWrong}
          className={styles.secondary}
        >
          Slightly Wrong
        </AnswerButton>
      )}
    </div>
  );
}
