import { useState } from 'react';
import { Ban, Star } from 'lucide-react';
import { QuizModal } from './QuizModal';
import styles from './modalContent.module.css';

type AuthorAction = 'favorited' | 'blocked';

interface AuthorModalProps {
  authorId: number;
  authorUsername: string;
  onClose: () => void;
}

/**
 * What the reader can do about whoever wrote the question they are looking at.
 *
 * Both actions are one-way and take effect immediately, so each button retires
 * itself once it succeeds.
 */
export function AuthorModal({ authorId, authorUsername, onClose }: AuthorModalProps) {
  const [done, setDone] = useState<AuthorAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: AuthorAction, request: Promise<Response>) => {
    setError(null);

    try {
      const response = await request;
      if (!response.ok) throw new Error(String(response.status));
      setDone(action);
    } catch {
      setError('That did not work. Please try again.');
    }
  };

  const favorite = () =>
    run(
      'favorited',
      fetch('/fav_user', {
        method: 'POST',
        credentials: 'same-origin',
        body: String(authorId),
      }),
    );

  const block = () => {
    const body = new FormData();
    body.append('block_user_id', String(authorId));

    return run(
      'blocked',
      fetch('/block_user', { method: 'POST', credentials: 'same-origin', body }),
    );
  };

  return (
    <QuizModal title="Question Author" onClose={onClose}>
      <p className={styles.meta}>Created by {authorUsername}</p>

      {done ? (
        <p className={styles.meta}>
          {done === 'favorited'
            ? `${authorUsername} was added to your favorites.`
            : `${authorUsername} is now blocked.`}
        </p>
      ) : (
        <div className={styles.actionRow}>
          <button type="button" className={styles.primaryBtn} onClick={favorite}>
            <Star className={styles.actionIcon} />
            <span>Add to Favorites</span>
          </button>

          <button type="button" className={styles.dangerBtn} onClick={block}>
            <Ban className={styles.actionIcon} />
            <span>Block User</span>
          </button>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </QuizModal>
  );
}
