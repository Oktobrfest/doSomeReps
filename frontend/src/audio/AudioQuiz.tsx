import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ButtonHTMLAttributes,
} from 'react';
import { AudioPlayer } from './AudioPlayer';
import { AudioCommandSystemComponent } from './AudioCommandSystem';
import {
  Volume2,
  BookOpen,
  Check,
  X,
  Ban,
  Pause,
  Play,
  Edit,
} from 'lucide-react';
import type { AudioQuizProps } from './types';
import styles from './AudioQuiz.module.css';
import actionStyles from './ActionButton.module.css';

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
      className={cx(actionStyles.largeBtn, className)}
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
      <div
        className={cx(actionStyles.largeBtn, actionStyles.hasSlider, className)}
        style={{ cursor: 'default' }}
      >
        <button
          type="button"
          onClick={onClick}
          className={styles.playPauseToggleBtn}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 0,
          }}
        >
          {isPlaying ? (
            <Pause className={actionStyles.iconLarge} />
          ) : (
            <Play className={actionStyles.iconLarge} />
          )}
          <span>{isPlaying ? 'Pause' : 'Resume'}</span>
        </button>

        <AudioPlayer
          assets={assets}
          isPlaying={isPlaying}
          onSequenceEnd={onSequenceEnd}
        />
      </div>
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
      setAnswerRevealed(false);
    }

    setQuestionActive(true);
    setQuestionPlaying(true);
  }, [questionActive, answerActive]);

  useEffect(() => {
    (window as any).audioReadQuestion = handleReadQuestion;
    return () => {
      delete (window as any).audioReadQuestion;
    };
  }, [handleReadQuestion]);

  const handlePause = useCallback(() => {
    setQuestionPlaying(false);
    setAnswerPlaying(false);
  }, []);

  useEffect(() => {
    (window as any).audioPause = handlePause;
    return () => {
      delete (window as any).audioPause;
    };
  }, [handlePause]);

  const handleResume = useCallback(() => {
    if (questionActive) {
      setQuestionPlaying(true);
    } else if (answerActive) {
      setAnswerPlaying(true);
    }
  }, [questionActive, answerActive]);

  useEffect(() => {
    (window as any).audioResume = handleResume;
    return () => {
      delete (window as any).audioResume;
    };
  }, [handleResume]);

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
        <div id="audio-command-root" className={styles.audioCommandRoot}>
          <AudioCommandSystemComponent />
        </div>

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
            className={actionStyles.orangeBtn}
            assets={questionAssets}
            onSequenceEnd={handleQuestionEnded}
          />
        ) : (
          <LargeActionButton
            onClick={handleReadQuestion}
            disabled={questionAssets.length === 0}
            className={actionStyles.orangeBtn}
          >
            <div className={actionStyles.btnContent}>
              <Volume2 className={actionStyles.iconLarge} />
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
              id="audio-get-answer-btn"
              onClick={handleGetAnswer}
              className={actionStyles.blueBtn}
            >
              <div className={actionStyles.btnContent}>
                <BookOpen className={actionStyles.iconLarge} />
                <span>Get Answer</span>
              </div>
            </LargeActionButton>
          )}

          {answerActive && (
            <LargePlayableControl
              onClick={handleAnswerToggle}
              isPlaying={answerPlaying}
              className={actionStyles.blueBtn}
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
                className={cx(styles.flex1, actionStyles.greenBtn)}
              >
                <div className={actionStyles.btnContent}>
                  <Check className={actionStyles.iconLarge} />
                  <span>Correct!</span>
                </div>
              </LargeActionButton>

              <LargeActionButton
                type="submit"
                name="incorrect_submit"
                value="Wrong!"
                className={cx(styles.flex1, actionStyles.redBtn)}
              >
                <div className={actionStyles.btnContent}>
                  <X className={actionStyles.iconLarge} />
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
              <BookOpen className={actionStyles.iconSmall} />
              The Answer
            </h5>

            <pre className={styles.cardContent}>
              {question.answer}
            </pre>
          </div>
        )}
      </div>

      <div className={styles.adminActions}>
        <LargeActionButton
          type="submit"
          name="exclude-question-button"
          value="exclude"
          className={cx(styles.flex1, actionStyles.redBtn)}
        >
          <div className={actionStyles.btnContent}>
            <Ban className={actionStyles.iconLarge} />
            <span>Exclude</span>
          </div>
        </LargeActionButton>

        {question.created_by_username === currentUsername && (
          <a
            href={`${editQuestionUrl}?q_id=${question.question_id}`}
            className={cx(actionStyles.largeBtn, styles.flex1, actionStyles.cyanBtn)}
            style={{ textDecoration: 'none' }}
          >
            <div className={actionStyles.btnContent}>
              <Edit className={actionStyles.iconLarge} />
              <span>Edit Question</span>
            </div>
          </a>
        )}
      </div>
    </form>
  );
}
