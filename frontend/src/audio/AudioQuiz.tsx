import {
  useState,
  useCallback,
  useMemo,
  type ButtonHTMLAttributes,
} from 'react';
import { AudioPlayer } from './AudioPlayer';
import {
  Volume2,
  BookOpen,
  Check,
  X,
  Ban,
  Pause,
  Play,
} from 'lucide-react';
import type { AudioQuizProps } from './types';
import styles from './AudioQuiz.module.css';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface LargeActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

function LargeActionButton({
  className,
  children,
  type = 'button',
  ...props
}: LargeActionButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.largeBtn, className)}
      {...props}
    >
      {children}
    </button>
  );
}

interface PlayableControlProps {
  onClick: () => void;
  isPlaying: boolean;
  className?: string;
  assets: any[];
  onSequenceEnd: () => void;
}

function LargePlayableControl({
  onClick,
  isPlaying,
  className,
  assets,
  onSequenceEnd,
}: PlayableControlProps) {
  return (
    <div className={styles.playableControl}>
      <button
        type="button"
        onClick={onClick}
        className={cx(styles.largeBtn, styles.hasSlider, className)}
      >
        <div className={styles.btnContent}>
          {isPlaying ? (
            <Pause className={styles.iconLarge} />
          ) : (
            <Play className={styles.iconLarge} />
          )}
          <span>{isPlaying ? 'Pause' : 'Resume'}</span>
        </div>

        <AudioPlayer
          assets={assets}
          isPlaying={isPlaying}
          onSequenceEnd={onSequenceEnd}
        />
      </button>
    </div>
  );
}

export function AudioQuiz({
  question,
  audioAssets,
  currentUsername,
  editQuestionUrl,
  csrfToken,
}: AudioQuizProps) {
  const [questionPlaying, setQuestionPlaying] = useState(false);
  const [questionActive, setQuestionActive] = useState(false);

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [answerPlaying, setAnswerPlaying] = useState(false);
  const [answerActive, setAnswerActive] = useState(false);

  const questionAssets = useMemo(() => audioAssets?.question ?? [], [audioAssets]);
  const answerAssets = useMemo(() => audioAssets?.answer ?? [], [audioAssets]);

  const handleReadQuestion = useCallback(() => {
    if (questionActive) {
      setQuestionPlaying((prev) => !prev);
      return;
    }

    if (answerActive) {
      setAnswerActive(false);
      setAnswerPlaying(false);
    }

    setQuestionActive(true);
    setQuestionPlaying(true);
  }, [questionActive, answerActive]);

  const handleQuestionEnded = useCallback(() => {
    setQuestionActive(false);
    setQuestionPlaying(false);
  }, []);

  const handleGetAnswer = useCallback(() => {
    setAnswerRevealed(true);

    if (questionActive) {
      setQuestionActive(false);
      setQuestionPlaying(false);
    }

    if (answerAssets.length > 0) {
      setAnswerActive(true);
      setAnswerPlaying(true);
    }
  }, [questionActive, answerAssets.length]);

  const handleAnswerToggle = useCallback(() => {
    setAnswerPlaying((prev) => !prev);
  }, []);

  const handleAnswerEnded = useCallback(() => {
    setAnswerActive(false);
    setAnswerPlaying(false);
  }, []);

  if (!question) {
    return (
      <form method="post" className={styles.centerContainer}>
        {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}

        <button
          type="submit"
          name="start-quiz"
          className={styles.startBtn}
        >
          Start!
        </button>
      </form>
    );
  }

  return (
    <form method="post" className={styles.quizContainer}>
      {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}
      <input type="hidden" name="quizq-id" value={question.quizq_id} />

      <div className={styles.actionsSection}>
        <div id="audio-command-root" className={styles.audioCommandRoot} />

        {question.pics.question_image?.map((pic, i) =>
          pic ? (
            <div key={i} className={styles.imageContainer}>
              <img
                src={pic}
                alt="Question"
                className={styles.questionImage}
              />
            </div>
          ) : null
        )}

        {questionActive ? (
          <LargePlayableControl
            onClick={handleReadQuestion}
            isPlaying={questionPlaying}
            className={styles.orangeBtn}
            assets={questionAssets}
            onSequenceEnd={handleQuestionEnded}
          />
        ) : (
          <LargeActionButton
            onClick={handleReadQuestion}
            disabled={questionAssets.length === 0}
            className={styles.orangeBtn}
          >
            <div className={styles.btnContent}>
              <Volume2 className={styles.iconLarge} />
              <span>Read Question</span>
            </div>
          </LargeActionButton>
        )}

        <div className={styles.middleSection}>
          {answerRevealed && question.pics.answer_pics?.some(Boolean) && (
            <div className={styles.answerImageContainer}>
              {question.pics.answer_pics?.map((pic, i) =>
                pic ? (
                  <img
                    key={i}
                    src={pic}
                    alt="Answer"
                    className={styles.questionImage}
                  />
                ) : null
              )}
            </div>
          )}

          {!answerRevealed && (
            <LargeActionButton
              onClick={handleGetAnswer}
              className={styles.orangeBtn}
            >
              <div className={styles.btnContent}>
                <BookOpen className={styles.iconLarge} />
                <span>Get Answer</span>
              </div>
            </LargeActionButton>
          )}

          {answerActive && (
            <LargePlayableControl
              onClick={handleAnswerToggle}
              isPlaying={answerPlaying}
              className={styles.cyanBtn}
              assets={answerAssets}
              onSequenceEnd={handleAnswerEnded}
            />
          )}

          {answerRevealed && (
            <div className={styles.btnGroup}>
              <LargeActionButton
                type="submit"
                name="correct_submit"
                value="Correct!"
                className={cx(styles.flex1, styles.greenBtn)}
              >
                <div className={styles.btnContent}>
                  <Check className={styles.iconLarge} />
                  <span>Correct!</span>
                </div>
              </LargeActionButton>

              <LargeActionButton
                type="submit"
                name="incorrect_submit"
                value="Wrong!"
                className={cx(styles.flex1, styles.redBtn)}
              >
                <div className={styles.btnContent}>
                  <X className={styles.iconLarge} />
                  <span>Wrong!</span>
                </div>
              </LargeActionButton>
            </div>
          )}
        </div>
      </div>

      <div className={styles.contentDivider}>
        <div className={styles.metaRow}>
          <strong>Level {question.level_no}</strong>

          {question.categories.map((cat) => (
            <span key={cat} className={styles.badge}>
              {cat}
            </span>
          ))}
        </div>

        <p className={styles.textBlock}>{question.question_text}</p>

        {answerRevealed && (
          <div className={styles.card}>
            <h5 className={styles.cardTitle}>
              <BookOpen className={styles.iconSmall} />
              The Answer
            </h5>

            <pre className={styles.cardContent}>
              {question.answer}
            </pre>
          </div>
        )}
      </div>

      <div className={styles.adminActions}>
        <button
          type="submit"
          name="exclude-question-button"
          value="exclude"
          className={styles.secondaryBtn}
        >
          <Ban className={styles.iconTiny} />
          Exclude
        </button>

        {question.created_by_username === currentUsername && (
          <a
            href={`${editQuestionUrl}?q_id=${question.question_id}`}
            className={styles.secondaryBtn}
          >
            Edit Question
          </a>
        )}
      </div>
    </form>
  );
}
