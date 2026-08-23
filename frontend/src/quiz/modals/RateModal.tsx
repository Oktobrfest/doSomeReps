import { useState } from 'react';
import { Star } from 'lucide-react';
import { QuizModal } from './QuizModal';
import styles from './modalContent.module.css';

const STARS = [1, 2, 3, 4, 5];

interface RateModalProps {
  quizqId: string | number;
  /** Average rating across all users, 0 when nobody has rated it yet. */
  averageRating: number;
  userRating: number | null;
  csrfToken?: string;
  onRated: (rating: number) => void;
  onClose: () => void;
}

export function RateModal({
  quizqId,
  averageRating,
  userRating,
  csrfToken,
  onRated,
  onClose,
}: RateModalProps) {
  const [rating, setRating] = useState(userRating);
  const [error, setError] = useState<string | null>(null);

  const rate = async (value: number) => {
    setRating(value);
    setError(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;

    try {
      const response = await fetch('/rateq', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ quizq_id: quizqId, rating: value }),
      });

      if (!response.ok) throw new Error(String(response.status));

      onRated(value);
    } catch {
      setRating(userRating);
      setError('Could not save your rating. Please try again.');
    }
  };

  return (
    <QuizModal title="Rate Question" onClose={onClose}>
      <p className={styles.meta}>
        {averageRating > 0
          ? `Average rating: ${averageRating.toFixed(1)}`
          : 'Nobody has rated this question yet.'}
      </p>

      <div className={styles.stars} role="radiogroup" aria-label="Your rating">
        {STARS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            className={styles.starBtn}
            onClick={() => rate(value)}
          >
            <Star
              className={
                rating !== null && value <= rating ? styles.starOn : styles.starOff
              }
            />
          </button>
        ))}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
    </QuizModal>
  );
}
