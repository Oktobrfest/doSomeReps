import { useState, useCallback, useRef, useEffect, type TouchEvent, type KeyboardEvent } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ImageModal.module.css';
import sharedStyles from '../styles/shared.module.css';
import { SlideOutButtons } from './SlideOutButtons';

/* The lightbox's chrome is the shared button base, round and glass. The close
   button takes the touch tier, which is what makes it the larger of the two
   on a phone and the same as every other control on a desktop. */
const glassRoundClass = [
  sharedStyles.actionButton,
  sharedStyles.buttonRound,
  sharedStyles.btnGlass,
].join(' ');

const closeClass = `${glassRoundClass} ${sharedStyles.buttonTouchSm} ${styles.closeBtn}`;
const modalArrowClass = `${glassRoundClass} ${styles.modalArrow}`;

interface ImageModalProps {
  images: string[];
  startIndex: number;
  onClose: () => void;
  onCorrect?: () => void;
  onWrong?: () => void;
  onSlightlyWrong?: () => void;
}

export function ImageModal({ images, startIndex, onClose, onCorrect, onWrong, onSlightlyWrong }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const touchStartX = useRef<number>(0);
  const touchDeltaX = useRef<number>(0);

  const goNext = useCallback(
    () => setCurrentIndex((prev) => (prev + 1) % images.length),
    [images.length],
  );

  const goPrev = useCallback(
    () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length),
    [images.length],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handleKeyDown as unknown as EventListener);
    return () => document.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
  }, [onClose, goNext, goPrev]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 50;
    if (touchDeltaX.current > threshold) {
      goPrev();
    } else if (touchDeltaX.current < -threshold) {
      goNext();
    }
  }, [goNext, goPrev]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the backdrop itself, not an image or button
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (images.length === 0) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
    >
      <div
        className={styles.modalViewport}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={styles.slideTrack}
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((src, i) => (
            <div key={i} className={styles.slide}>
              <img
                src={src}
                alt=""
                className={styles.slideImage}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Counter */}
        <span className={styles.modalCounter}>
          {currentIndex + 1} / {images.length}
        </span>

        {/* Dots */}
        {images.length > 1 && (
          <div className={styles.modalDots}>
            {images.map((_, i) => (
              <span
                key={i}
                className={`${styles.modalDot} ${i === currentIndex ? styles.modalDotActive : ''}`}
              />
            ))}
          </div>
        )}

        {/* Navigation arrows (only when more than 1 image) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              className={`${modalArrowClass} ${styles.modalArrowLeft}`}
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className={sharedStyles.buttonIcon} />
            </button>

            <button
              type="button"
              className={`${modalArrowClass} ${styles.modalArrowRight}`}
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
            >
              <ChevronRight className={sharedStyles.buttonIcon} />
            </button>
          </>
        )}
      </div>

      {/* Close button */}
      <button
        type="button"
        className={closeClass}
        onClick={onClose}
        aria-label="Close"
      >
        <X className={sharedStyles.buttonIcon} />
      </button>

      {/* Answer buttons at the very bottom */}
      {(onCorrect || onWrong || onSlightlyWrong) && (
        <SlideOutButtons
          className={styles.modalAnswerBar}
          size="compact"
          expandToTrio
          onCorrect={onCorrect}
          onWrong={onWrong}
          onSlightlyWrong={onSlightlyWrong}
        />
      )}
    </div>
  );
}
