import { Star } from 'lucide-react';
import styles from './RatingStars.module.css';

const STARS = [1, 2, 3, 4, 5];

interface RatingStarsProps {
  /** How many stars are filled. An average rounds to the nearest whole star. */
  value: number;
  /** Announced in place of the five icons. */
  label: string;
  /** With a handler the stars are the control a reader rates with, without it
   *  they are a reading of a rating already given. */
  onRate?: (value: number) => void;
  /** The class list of whatever the stars sit in: it owns the tier they wear. */
  className?: string;
}

/** A rating read at a glance, where five stars would not fit: the average and one star. */
export function RatingBadge({ value }: { value: number }) {
  const average = value.toFixed(1);

  return (
    <span className={styles.badge} role="img" aria-label={`Rated ${average} out of 5`}>
      {average}
      <Star className={styles.starOn} />
    </span>
  );
}

export function RatingStars({ value, label, onRate, className }: RatingStarsProps) {
  const filled = Math.round(value);
  const starClass = (star: number) => (star <= filled ? styles.starOn : styles.starOff);

  if (!onRate) {
    return (
      <span className={`${styles.stars} ${className || ''}`} role="img" aria-label={label}>
        {STARS.map((star) => (
          <Star key={star} className={starClass(star)} />
        ))}
      </span>
    );
  }

  return (
    <div className={`${styles.stars} ${className || ''}`} role="radiogroup" aria-label={label}>
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === filled}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className={styles.starBtn}
          onClick={() => onRate(star)}
        >
          <Star className={starClass(star)} />
        </button>
      ))}
    </div>
  );
}
