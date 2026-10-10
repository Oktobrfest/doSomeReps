import { useId, type ReactNode } from 'react';
import { BookOpen, Lightbulb } from 'lucide-react';
import { MarkdownContent } from '../components/MarkdownContent';
import { ImageCarousel } from '../quiz/ImageCarousel';
import { QUESTION_PART_SPECS, type QuestionPart as Part } from './question_types';
import sharedStyles from '../styles/shared.module.css';
import styles from './QuestionReading.module.css';

export interface Disclosure {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

type HeadedPart = Exclude<Part, 'question'>;

/** Shared colored field; the caller owns disclosure and page-specific actions. */
export function QuestionPart({ part, disclosure, children }: {
  part: HeadedPart;
  disclosure?: Disclosure;
  children: ReactNode;
}) {
  const id = useId();
  const open = disclosure?.open ?? true;
  const Icon = part === 'answer' ? BookOpen : Lightbulb;
  const title = <>{QUESTION_PART_SPECS[part].name} <Icon className={sharedStyles.buttonIcon} /></>;

  return (
    <section className={`${styles.part} ${styles[part]}`}>
      <div className={styles.partHeader}>
        {disclosure ? (
          <button
            type="button"
            className={sharedStyles.disclosureToggle}
            aria-expanded={open}
            aria-controls={id}
            disabled={disclosure.disabled}
            onClick={disclosure.onToggle}
          >
            {title}
          </button>
        ) : title}
      </div>
      <div id={id} hidden={!open} className={styles.partBody}>
        {open && children}
      </div>
    </section>
  );
}

export function QuestionText({ text }: { text: string }) {
  return <div className={styles.text}><MarkdownContent content={text} /></div>;
}

export type OpenImages = (images: string[], startIndex: number) => void;

export function QuestionImages({ images, onOpen }: { images: string[]; onOpen: OpenImages }) {
  return images.length > 0 ? (
    <div className={styles.images}>
      <ImageCarousel images={images} onImageClick={(index) => onOpen(images, index)} />
    </div>
  ) : null;
}

/** The quiz and full-question view share both prose and image presentation. */
export function QuestionReadingPart({ part, text, images, onOpen, disclosure, children }: {
  part: HeadedPart;
  text: string | null;
  images: string[];
  onOpen: OpenImages;
  disclosure?: Disclosure;
  children?: ReactNode;
}) {
  return (
    <QuestionPart part={part} disclosure={disclosure}>
      {text && <QuestionText text={text} />}
      <QuestionImages images={images} onOpen={onOpen} />
      {children}
    </QuestionPart>
  );
}
