import { MediaSection } from "../components/MediaSection";
import { readBootstrap } from "./about_api";
import { formatDuration } from "./formatDuration";
import styles from "./About.module.css";

const bootstrap = readBootstrap();

/** Each interval reads as its own wait plus the gap since the previous one. */
function intervalLabel(daysHence: number, previousDaysHence?: number): string {
  const current = formatDuration(daysHence);
  if (previousDaysHence === undefined) {
    return current;
  }
  return `${current} (${formatDuration(daysHence - previousDaysHence)})`;
}

export function AboutPage() {
  return (
    <div className={styles.page}>
      <MediaSection
        imageSrc={bootstrap.images.siteFormat}
        imageAlt="Site Format Image"
        title="Site Format"
      >
        <p>
          This site uses a question/answer format of learning which has been
          shown to help activate your brain on a deeper level than by other
          methodologies like passively reading notes or watching videos. In
          order to optimally learn you need to engauge your brain! Sorry, I know
          it hurts sometimes, but no pain no gain!
        </p>
      </MediaSection>

      <MediaSection
        imageSrc={bootstrap.images.activeVsPassive}
        imageAlt="Black Board"
        imagePosition="right"
        title="Active vs. Passive Learning"
      >
        <p>
          Spaced repetition is considered an active form of learning. Because
          you're forced to recall material you're more "actiively" using your
          brain, as opposed to jusst passively feeding yourself information andd
          hoping it sticks. Active learning hass been shown to be far more
          effective studying strategy enhances the retention of studied
          material.
        </p>
      </MediaSection>

      <MediaSection
        imageSrc={bootstrap.images.community}
        imageAlt="pcb-brain"
        title="Community"
      >
        <p>
          There is some pre-existing material that you may be interested in
          studying on this site, however it is intended that you upload
          materials your interested in studying and share it with the community.
          Shared material gets rated by the community and you could choose to
          block users or follow others to learn from their uploaded content. You
          can also choose to keep everything you upload completely private. If
          some days you only want to study some categories instead of others,
          just unselect those categories in the take quiz page.
        </p>
      </MediaSection>

      <MediaSection
        imageSrc={bootstrap.images.hourglass}
        imageAlt="hour glass"
        title="Our spaced intervals:"
      >
        <ol className={styles.intervalList}>
          {bootstrap.intervals.map((interval, index) => (
            <li key={interval.levelNo}>
              {intervalLabel(
                interval.daysHence,
                bootstrap.intervals[index - 1]?.daysHence
              )}
            </li>
          ))}
        </ol>
      </MediaSection>

      <section className={styles.wideSection}>
        <h3 className={styles.wideTitle}>Why bother with spaced repetition?</h3>
        <p>
          Ultimately, spaced repetition helps you permanantly retain what you're
          studying! By exposing yourself to the same material a few more times,
          you can hold onto the knowledge you teach yourself forever! Don't fool
          yourself into thinking you'll remember everything from one study
          session.
        </p>
      </section>
    </div>
  );
}
