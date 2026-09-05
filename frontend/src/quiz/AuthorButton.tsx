import { useState } from 'react';
import { User } from 'lucide-react';
import sharedStyles from '../styles/shared.module.css';
import { AuthorModal } from './modals/AuthorModal';

export interface QuestionAuthor {
  id: number;
  username: string;
  /** A reader's own questions still name the author, but there is nothing to act on. */
  isSelf: boolean;
}

interface AuthorButtonProps {
  author: QuestionAuthor;
  /** The class list of the row the control sits in: the row owns the styling. */
  className: string;
  disabled?: boolean;
}

/**
 * Names whoever wrote the question on screen, and opens the author dialog.
 *
 * The dialog belongs to the button rather than to the page, so wherever the
 * control is placed it arrives complete, the way the flag control does.
 */
export function AuthorButton({ author, className, disabled = false }: AuthorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled || author.isSelf}
        className={className}
      >
        <User className={sharedStyles.buttonIcon} />
        <span>{author.username}</span>
      </button>

      {isOpen && (
        <AuthorModal
          authorId={author.id}
          authorUsername={author.username}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
