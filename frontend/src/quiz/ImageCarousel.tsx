import { useState, useCallback, useRef, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ImageCarousel.module.css';
import sharedStyles from '../styles/shared.module.css';

/* An arrow is the shared button base at its dense tier: round, and wearing the
   scrim so it stays readable over any image. */
const arrowClass = [
  sharedStyles.actionButton,
  sharedStyles.buttonSm,
  sharedStyles.buttonRound,
  sharedStyles.btnScrim,
  styles.arrow,
].join(' ');

interface ImageCarouselProps {
  images: (string | null)[];
  /** Called when the user clicks/taps an image to open the modal */
  onImageClick: (startIndex: number) => void;
}

export function ImageCarousel({ images, onImageClick }: ImageCarouselProps) {
  const filtered = images.filter((img): img is string => img !== null && img !== undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchDeltaX = useRef<number>(0);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, filtered.length - 1)));
  }, [filtered.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % filtered.length);
  }, [filtered.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
  }, [filtered.length]);

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

  if (filtered.length === 0) return null;

  if (filtered.length === 1) {
    // Single image — no carousel UI, but clicking opens the modal.
    return (
      <div className={styles.carouselWrapper}>
        <div className={styles.viewport} onClick={() => onImageClick(0)}>
          <img
            src={filtered[0]}
            alt=""
            className={styles.slideImage}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.carouselWrapper}>
      <div
        className={styles.viewport}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onImageClick(currentIndex)}
      >
        <div
          className={styles.slideTrack}
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {filtered.map((src, i) => (
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

        {/* Counter badge */}
        <span className={styles.counter}>
          {currentIndex + 1} / {filtered.length}
        </span>

        {/* Left / Right arrows */}
        <button
          type="button"
          className={`${arrowClass} ${styles.arrowLeft}`}
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
          className={`${arrowClass} ${styles.arrowRight}`}
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next image"
        >
          <ChevronRight className={sharedStyles.buttonIcon} />
        </button>
      </div>

      {/* Dot indicators */}
      <div className={styles.dots}>
        {filtered.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              goTo(i);
            }}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
