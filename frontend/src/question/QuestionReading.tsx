import { useId, useState, type ReactNode } from 'react';
import { BookOpen, Lightbulb } from 'lucide-react';
import { MarkdownContent } from '../components/MarkdownContent';
import { ImageCarousel } from '../quiz/ImageCarousel';
import { QUESTION_PART_SPECS, type QuestionDraft, type QuestionPart as Part } from './question_types';
import { useFilePreviews } from './useFilePreviews';
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

export function QuestionText({ text, compact = false }: { text: string; compact?: boolean }) {
  const content = <MarkdownContent content={text} />;
  return compact ? content : <div className={styles.text}>{content}</div>;
}

export type OpenImages = (images: string[], startIndex: number) => void;

export function QuestionImages({ images, onOpen }: { images: string[]; onOpen: OpenImages }) {
  return images.length > 0 ? (
    <div className={styles.images}>
      <ImageCarousel images={images} onImageClick={(index) => onOpen(images, index)} />
    </div>
  ) : null;
}

/** Without a lightbox callback, result cards use compact text and thumbnails. */
export function QuestionBody({ draft, part, onOpen }: {
  draft: QuestionDraft;
  part: Part;
  onOpen?: OpenImages;
}) {
  const previews = useFilePreviews(draft.files[part]);
  const images = [...draft.pics[part].map((pic) => pic.pic_string), ...previews];
  const text = draft.text[part] || (part === 'hint' ? '' : `*No ${part} text yet.*`);
  const media = onOpen ? <QuestionImages images={images} onOpen={onOpen} /> : (
    images.length > 0 && <div className={styles.previewImages}>
      {images.map((src, index) => (
        <img key={index} src={src} alt={`${part} visual ${index + 1}`} className={styles.previewImage} />
      ))}
    </div>
  );
  return <>
    {part === 'question' && onOpen && media}
    {text && <QuestionText text={text} compact={!onOpen} />}
    {(part !== 'question' || !onOpen) && media}
  </>;
}

/** The full view and editor previews use identical content and start expanded. */
export function QuestionView({ draft, onOpen }: { draft: QuestionDraft; onOpen: OpenImages }) {
  const [hintOpen, setHintOpen] = useState(true);
  const [answerOpen, setAnswerOpen] = useState(true);
  const hasHint = Boolean(draft.text.hint) || draft.pics.hint.length > 0 || draft.files.hint.length > 0;
  return (
    <div className={styles.reading}>
      <QuestionBody draft={draft} part="question" onOpen={onOpen} />
      {hasHint && (
        <QuestionPart part="hint" disclosure={{ open: hintOpen, onToggle: () => setHintOpen((open) => !open) }}>
          <QuestionBody draft={draft} part="hint" onOpen={onOpen} />
        </QuestionPart>
      )}
      <QuestionPart part="answer" disclosure={{ open: answerOpen, onToggle: () => setAnswerOpen((open) => !open) }}>
        <QuestionBody draft={draft} part="answer" onOpen={onOpen} />
      </QuestionPart>
    </div>
  );
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
