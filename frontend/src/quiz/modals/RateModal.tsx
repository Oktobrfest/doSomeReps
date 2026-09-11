import { jsonHeaders } from '../../lib/http';
import { useState } from 'react';
import { RatingStars } from '../RatingStars';
import { QuizModal } from '../../components/QuizModal';
import styles from './modalContent.module.css';

interface RateModalProps {
  quizqId: string | number;
  /** Average rating across all users, 0 when nobody has rated it yet. */
  averageRating: number;
  userRating: number | null;
  onRated: (rating: number) => void;
  onClose: () => void;
}

export function RateModal({
  quizqId,
  averageRating,
  userRating,
  onRated,
  onClose,
}: RateModalProps) {
  const [rating, setRating] = useState(userRating);
  const [error, setError] = useState<string | null>(null);

  const rate = async (value: number) => {
    setRating(value);
    setError(null);

    try {
      const response = await fetch('/rateq', {
        method: 'POST',
        headers: jsonHeaders(),
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

      <RatingStars
        value={rating ?? 0}
        label="Your rating"
        onRate={rate}
        className={styles.ratingStars}
      />

      {error && <p className={styles.error} role="alert">{error}</p>}
    </QuizModal>
  );
}
