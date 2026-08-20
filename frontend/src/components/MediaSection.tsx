import type { ReactNode } from "react";
import styles from "./MediaSection.module.css";

interface MediaSectionProps {
  imageSrc: string;
  imageAlt: string;
  /** Which side the image sits on while the section is wide enough to split. */
  imagePosition?: "left" | "right";
  title?: string;
  children: ReactNode;
}

/** An illustration paired with a block of copy - the layout the marketing
 *  pages (/about, logged-out /) repeat for every section. */
export function MediaSection({
  imageSrc,
  imageAlt,
  imagePosition = "left",
  title,
  children,
}: MediaSectionProps) {
  const className =
    imagePosition === "right"
      ? `${styles.section} ${styles.imageRight}`
      : styles.section;

  return (
    <section className={className}>
      <div className={styles.imageFrame}>
        <img className={styles.image} src={imageSrc} alt={imageAlt} />
      </div>

      <div className={styles.body}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {children}
      </div>
    </section>
  );
}
