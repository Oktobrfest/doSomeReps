import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
} from 'react';
import { AudioPlayer } from './AudioPlayer';
import { AudioCommandSystemComponent } from './AudioCommandSystem';
import { ImageCarousel } from './ImageCarousel';
import { ImageModal } from './ImageModal';
import {
  Volume2,
  BookOpen,
  Ban,
  Pause,
  Play,
  Edit,
} from 'lucide-react';
import type { AudioQuizProps } from './types';
import styles from './AudioQuiz.module.css';
import actionStyles from './ActionButton.module.css';
import { SlideOutButtons, type ExtraAction } from './SlideOutButtons';
import { MarkdownContent } from '../components/MarkdownContent';

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
  const [wasEverPlaying, setWasEverPlaying] = useState(false);

  useEffect(() => {
    if (isPlaying) {
      setWasEverPlaying(true);
    }
  }, [isPlaying]);

  const handleSequenceEnd = useCallback(() => {
    setWasEverPlaying(false);
    onSequenceEnd();
  }, [onSequenceEnd]);

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
          <span>{isPlaying ? 'Pause' : wasEverPlaying ? 'Resume' : 'Play'}</span>
        </button>

        <AudioPlayer
          assets={assets}
          isPlaying={isPlaying}
          onSequenceEnd={handleSequenceEnd}
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
  categoryList,
  selectedCategories,
}: AudioQuizProps) {
  const [questionPlaying, setQuestionPlaying] = useState(false);
  const [questionActive, setQuestionActive] = useState(false);

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [answerPlaying, setAnswerPlaying] = useState(false);
  const [answerActive, setAnswerActive] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalStartIndex, setModalStartIndex] = useState(0);
  const [slideOutHeight, setSlideOutHeight] = useState(0);

  // Form ref for programmatic submission from modal
  const formRef = useRef<HTMLFormElement>(null);

  // Build extra actions for the answer buttons drawer
  const extraActions = useMemo((): ExtraAction[] => {
    const actions: ExtraAction[] = [
      {
        key: 'exclude',
        label: 'Exclude',
        icon: <Ban className={actionStyles.iconLarge} />,
        variant: 'exclude',
        submitName: 'exclude-question-button',
        submitValue: 'exclude',
      },
    ];

    if (question?.created_by_username === currentUsername) {
      actions.push({
        key: 'edit',
        label: 'Edit Question',
        icon: <Edit className={actionStyles.iconLarge} />,
        variant: 'edit',
        href: `${editQuestionUrl}?q_id=${question.question_id}`,
      });
    }

    return actions;
  }, [question, currentUsername, editQuestionUrl]);

  // Global audio coordination: only one audio source plays at a time.
  // Each AudioPlayer-capable component registers a stop callback.
  // Before any playback starts, all other registered callbacks are called.
  const stopAllAudio = useCallback(() => {
    const callbacks: Array<(() => void) | undefined> = (window as any).__audioStopCallbacks;
    if (Array.isArray(callbacks)) {
      callbacks.forEach((cb) => { try { cb?.(); } catch { /* ignore */ } });
    }
  }, []);

  // Register/unregister this component's stop callback.
  useEffect(() => {
    const stopMe = () => {
      setQuestionPlaying(false);
      setAnswerPlaying(false);
    };
    if (!(window as any).__audioStopCallbacks) {
      (window as any).__audioStopCallbacks = [];
    }
    (window as any).__audioStopCallbacks.push(stopMe);
    return () => {
      const arr: Array<(() => void) | undefined> = (window as any).__audioStopCallbacks;
      if (arr) {
        const idx = arr.indexOf(stopMe);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }, []);

  // Shared helper to submit the quiz form from the answer buttons.
  const submitForm = useCallback((name: string, value: string) => {
    if (!formRef.current) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    formRef.current.appendChild(input);
    formRef.current.requestSubmit();
  }, []);

  const handleCorrect = useCallback(() => {
    submitForm('correct_submit', 'Correct!');
  }, [submitForm]);

  const handleWrong = useCallback(() => {
    submitForm('incorrect_submit', 'Wrong!');
  }, [submitForm]);

  const handleSlightlyWrong = useCallback(() => {
    submitForm('incorrect_submit', 'Slightly Wrong');
  }, [submitForm]);

  const openModal = useCallback((images: string[], startIndex: number) => {
    setModalImages(images);
    setModalStartIndex(startIndex);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const questionAssets = useMemo(() => audioAssets?.question ?? [], [audioAssets]);
  const answerAssets = useMemo(() => audioAssets?.answer ?? [], [audioAssets]);

  const handleReadQuestion = useCallback(() => {
    if (questionActive) {
      setQuestionPlaying((prev) => !prev);
      return;
    }

    stopAllAudio();

    if (answerActive) {
      setAnswerActive(false);
      setAnswerPlaying(false);
      setAnswerRevealed(false);
    }

    setQuestionActive(true);
    setQuestionPlaying(true);
  }, [questionActive, answerActive, stopAllAudio]);

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

  // Auto-read the question when a new question loads in audio mode.
  useEffect(() => {
    if (!question || questionAssets.length === 0) return;
    const wasListening = sessionStorage.getItem("audio_listening_active") === "true";
    if (!wasListening) return;

    // Small delay to let the DOM settle before starting audio.
    const timer = setTimeout(() => {
      setQuestionActive(true);
      setQuestionPlaying(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [question, questionAssets]);

  const handleQuestionEnded = useCallback(() => {
    setQuestionActive(false);
    setQuestionPlaying(false);
  }, []);

  const handleGetAnswer = useCallback(() => {
    if (answerActive) {
      setAnswerPlaying((prev) => !prev);
      return;
    }

    stopAllAudio();

    setAnswerRevealed(true);

    if (questionActive) {
      setQuestionActive(false);
      setQuestionPlaying(false);
    }

    if (answerAssets.length > 0) {
      setAnswerActive(true);
      setAnswerPlaying(true);
    }
  }, [questionActive, answerActive, answerAssets.length, stopAllAudio]);

  useEffect(() => {
    (window as any).audioGetAnswer = handleGetAnswer;
    return () => {
      delete (window as any).audioGetAnswer;
    };
  }, [handleGetAnswer]);

  const handleAnswerToggle = useCallback(() => {
    setAnswerPlaying((prev) => !prev);
  }, []);

  const handleAnswerEnded = useCallback(() => {
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
    <>
      {modalOpen && (
        <ImageModal
          images={modalImages}
          startIndex={modalStartIndex}
          onClose={closeModal}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onSlightlyWrong={handleSlightlyWrong}
        />
      )}
      <form method="post" className={styles.quizContainer} ref={formRef}>
      {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}
      <input type="hidden" name="quizq-id" value={question.quizq_id} />

      <div className={styles.actionsSection}>
        <div id="audio-command-root" className={styles.audioCommandRoot}>
          <AudioCommandSystemComponent
            question={question}
            answerRevealed={answerRevealed}
          />
        </div>

        {question.pics.question_image?.some(Boolean) && (
          <ImageCarousel
            images={question.pics.question_image}
            onImageClick={(startIndex) =>
              openModal(
                question.pics.question_image!.filter((p): p is string => !!p),
                startIndex,
              )
            }
          />
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
            <ImageCarousel
              images={question.pics.answer_pics}
              onImageClick={(startIndex) =>
                openModal(
                  question.pics.answer_pics!.filter((p): p is string => !!p),
                  startIndex,
                )
              }
            />
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
        </div>
      </div>

      <div
        className={styles.contentDivider}
        style={{ paddingBottom: `${slideOutHeight + 6}px` }}
      >
        <div className={styles.metaRow}>
          <strong>Level {question.level_no}</strong>

          {question.categories.map((cat) => (
            <span key={cat} className={styles.badge}>
              {cat}
            </span>
          ))}
        </div>

        <div className={styles.textBlock}>
          <MarkdownContent content={question.question_text} />
        </div>

        {answerRevealed && (
          <div className={styles.card}>
            <h5 className={styles.cardTitle}>
              <BookOpen className={actionStyles.iconSmall} />
              The Answer
            </h5>

            <div className={styles.cardContent}>
              <MarkdownContent content={question.answer} />
            </div>
          </div>
        )}
      </div>

      {answerRevealed && (
        <SlideOutButtons
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onSlightlyWrong={handleSlightlyWrong}
          extraActions={extraActions}
          onHeightChange={setSlideOutHeight}
          expandToTrio
          showCategories
          categoryList={categoryList}
          initialSelectedCategories={selectedCategories}
        />
      )}

      <div id="ask-ai-conversation-root" className={styles.askAiConversationRoot}></div>
    </form>
    </>
  );
}
