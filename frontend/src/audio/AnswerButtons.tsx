import { Check, X, Minus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import actionStyles from './ActionButton.module.css';

interface AnswerButtonsProps {
  className?: string;
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
}

interface AnswerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'correct' | 'wrong' | 'slightlyWrong';
}

function AnswerButton({
  variant,
  className,
  children,
  ...props
}: AnswerButtonProps) {
  const variantClass =
    variant === 'correct'
      ? actionStyles.greenBtn
      : variant === 'wrong'
        ? actionStyles.redBtn
        : actionStyles.orangeBtn;

  return (
    <button
      type="button"
      className={`${actionStyles.largeBtn} ${variantClass} ${className || ''}`}
      {...props}
    >
      <div className={actionStyles.btnContent}>
        {variant === 'correct' && <Check className={actionStyles.iconLarge} />}
        {variant === 'wrong' && <X className={actionStyles.iconLarge} />}
        {variant === 'slightlyWrong' && <Minus className={actionStyles.iconLarge} />}
        <span>{children}</span>
      </div>
    </button>
  );
}

export function AnswerButtons({
  className,
  onCorrect,
  onWrong,
  onSlightlyWrong,
}: AnswerButtonsProps) {
  return (
    <div className={className}>
      <AnswerButton variant="correct" onClick={onCorrect}>
        Correct!
      </AnswerButton>
      <AnswerButton variant="wrong" onClick={onWrong}>
        Wrong!
      </AnswerButton>
      <AnswerButton variant="slightlyWrong" onClick={onSlightlyWrong}>
        Slightly Wrong
      </AnswerButton>
    </div>
  );
}