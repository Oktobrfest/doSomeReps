import { MediaSection } from "../components/MediaSection";
import sharedStyles from "../styles/shared.module.css";
import { readBootstrap } from "./landing_api";
import styles from "./Landing.module.css";

const bootstrap = readBootstrap();

const charts = [
  {
    key: "forgetting",
    title: "",
    alt: "Retention over time with and without spaced repetition",
    data: bootstrap.forgettingChart,
  },
  {
    key: "categories",
    title: "Top category questions",
    alt: "Bar chart of the categories with the most questions",
    data: bootstrap.categoriesChart,
  },
];

export function LandingPage() {
  return (
    <div className={styles.page}>
      <h2 className={styles.headline}>
        DoSomeReps is a 100% free spaced repetition learning platform you can
        use to study any subject matter!
      </h2>

      <MediaSection
        imageSrc={bootstrap.images.graduationHat}
        imageAlt="Graduation Cap"
        title="Sign up now to get started:"
      >
        <a
          className={`${sharedStyles.actionButton} ${sharedStyles.btnRed}`}
          href={bootstrap.signupUrl}
        >
          Sign Up!
        </a>
      </MediaSection>

      <section className={styles.pitch}>
        <h3 className={styles.pitchTitle}>How this helps you?</h3>
        <p>
          Take the guess work out of having to worry about how often you should
          review study material! We automatically presents you with questions at
          key intervals right before your brain begins to forget the facts, thus
          challenging you to recall those near faded memories at just the right
          time. Our experimentally derived time gaps have been shown to maximize
          the retention of information with the fewest quantity of repetitions,
          thus saving you time studying.
        </p>
      </section>

      <MediaSection
        imageSrc={bootstrap.images.eduTree}
        imageAlt="education tree"
        title="Start Learning Properly:"
      >
        <a
          className={`${sharedStyles.actionButton} ${sharedStyles.btnRed}`}
          href={bootstrap.loginUrl}
        >
          Login!
        </a>
      </MediaSection>

      <p className={styles.seekingHelp}>
        I am looking for partners to help me finish the website faster to make
        it more appealing and convenient to use. Join me by messaging me on
        github or sending me an email if interested. daveemail@gmx.com
      </p>

      {charts.map((chart) => (
        <figure className={styles.chart} key={chart.key}>
          {chart.title && (
            <figcaption className={styles.chartTitle}>{chart.title}</figcaption>
          )}
          <img
            className={styles.chartImage}
            src={`data:image/png;base64,${chart.data}`}
            alt={chart.alt}
          />
        </figure>
      ))}
    </div>
  );
}
