import { useState } from 'react';
import { AutoResizeTextarea } from '../../components/AutoResizeTextarea';
import { QuizModal } from './QuizModal';
import styles from './modalContent.module.css';

interface AnswerDraftModalProps {
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

/**
 * Where the reader writes their own answer before revealing the real one.
 *
 * The draft is submitted alongside the verdict, so it ends up on the quiz
 * record as `provided_answer`.
 */
export function AnswerDraftModal({ value, onSave, onClose }: AnswerDraftModalProps) {
  const [draft, setDraft] = useState(value);

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <QuizModal title="Your Answer" onClose={onClose}>
      <AutoResizeTextarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        autoFocus
        className={styles.textarea}
        placeholder="Write your answer before revealing the real one."
      />

      <button type="button" className={styles.primaryBtn} onClick={save}>
        Save Answer
      </button>
    </QuizModal>
  );
}
