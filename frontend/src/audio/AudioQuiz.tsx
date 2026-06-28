import {
  useState,
  useCallback,
  useMemo,
  useEffect,
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
import type { AudioQuizProps, QuizItem } from './types';
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
  initialItems = [],
  currentUsername,
  editQuestionUrl,
  csrfToken,
  categoryList,
  selectedCategories,
}: AudioQuizProps) {
  // SPA queue: items[0] is the currently displayed question, items[1] is the
  // next question whose audio assets are already loaded.
  const [items, setItems] = useState<QuizItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questionPlaying, setQuestionPlaying] = useState(false);
  const [questionActive, setQuestionActive] = useState(false);

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [answerPlaying, setAnswerPlaying] = useState(false);
  const [answerActive, setAnswerActive] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalStartIndex, setModalStartIndex] = useState(0);
  const [panelSnap, setPanelSnap] = useState<'collapsed' | 'trio' | 'full'>('collapsed');

  // Fixed answer-text padding mapping chosen to keep the answer readable
  // without wasting space. No coupling to the live drag height.
  const answerPaddingBySnap: Record<'collapsed' | 'trio' | 'full', number> = {
    collapsed: 12,
    trio: 188,
    full: 340,
  };

  const currentItem = items[0] ?? null;
  const currentQuestion = currentItem?.question ?? null;

  const questionAssets = useMemo(
    () => currentItem?.audioAssets?.question ?? [],
    [currentItem],
  );
  const answerAssets = useMemo(
    () => currentItem?.audioAssets?.answer ?? [],
    [currentItem],
  );

  // Reset per-question UI state whenever the displayed question changes.
  useEffect(() => {
    setQuestionPlaying(false);
    setQuestionActive(false);
    setAnswerRevealed(false);
    setAnswerPlaying(false);
    setAnswerActive(false);
    setModalOpen(false);
  }, [currentQuestion?.quizq_id]);

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

  // API helpers ---------------------------------------------------------------

  const fetchBatch = useCallback(
    async (count: number, excludeQuizqIds: Array<string | number> = []) => {
      const params = new URLSearchParams();
      params.set('count', String(count));
      if (excludeQuizqIds.length > 0) {
        params.set('exclude_quizq_ids', excludeQuizqIds.map(String).join(','));
      }
      const res = await fetch(`/audio/quiz-data?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        throw new Error(`Failed to load audio quiz data (${res.status})`);
      }
      const data = await res.json();
      return (data.items || []) as QuizItem[];
    },
    [],
  );

  const postForm = useCallback(async (formData: FormData) => {
    const headers: Record<string, string> = {};
    const token = formData.get('csrf_token');
    if (token && typeof token === 'string') {
      headers['X-CSRFToken'] = token;
    }

    const res = await fetch('/audio', {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'same-origin',
    });
    if (!res.ok) {
      throw new Error(`Submission failed (${res.status})`);
    }
    // Server returns a redirect; the SPA ignores the redirect body.
  }, []);

  // Move the queued question into the display slot, then fetch another question
  // to keep the queue topped up to two items.
  const advanceQueue = useCallback(
    async (submittedQuizqId: string | number) => {
      let excludeIds: Array<string | number> = [];
      let count = 2;

      setItems((prevItems) => {
        const nextItems = prevItems.filter((item) => {
          const id = item.question?.quizq_id;
          return id === undefined || String(id) !== String(submittedQuizqId);
        });

        const newCurrent = nextItems[0] ?? null;
        excludeIds = newCurrent?.question
          ? [newCurrent.question.quizq_id]
          : [];
        count = newCurrent ? 1 : 2;

        return nextItems;
      });

      try {
        const fetched = await fetchBatch(count, excludeIds);
        setItems((prev) => [...prev, ...fetched]);
        setError(null);
      } catch (e) {
        setError('Could not load the next question. Please try again.');
      }
    },
    [fetchBatch],
  );

  const submitAnswer = useCallback(
    async (verdictField: string, verdictValue: string) => {
      if (!currentQuestion) return;
      const currentQuizqId = currentQuestion.quizq_id;

      setIsLoading(true);
      try {
        const formData = new FormData();
        if (csrfToken) formData.append('csrf_token', csrfToken);
        formData.append('quizq-id', String(currentQuizqId));
        formData.append(verdictField, verdictValue);
        await postForm(formData);
        await advanceQueue(currentQuizqId);
      } finally {
        setIsLoading(false);
      }
    },
    [advanceQueue, csrfToken, currentQuestion, postForm],
  );

  const handleCorrect = useCallback(() => {
    submitAnswer('correct_submit', 'Correct!');
  }, [submitAnswer]);

  useEffect(() => {
    (window as any).audioCorrect = handleCorrect;
    return () => {
      delete (window as any).audioCorrect;
    };
  }, [handleCorrect]);

  const handleWrong = useCallback(() => {
    submitAnswer('incorrect_submit', 'Wrong!');
  }, [submitAnswer]);

  useEffect(() => {
    (window as any).audioWrong = handleWrong;
    return () => {
      delete (window as any).audioWrong;
    };
  }, [handleWrong]);

  const handleSlightlyWrong = useCallback(() => {
    submitAnswer('incorrect_submit', 'Slightly Wrong');
  }, [submitAnswer]);

  useEffect(() => {
    (window as any).audioSlightlyWrong = handleSlightlyWrong;
    return () => {
      delete (window as any).audioSlightlyWrong;
    };
  }, [handleSlightlyWrong]);

  const handleExclude = useCallback(async () => {
    if (!currentQuestion) return;
    const currentQuizqId = currentQuestion.quizq_id;

    setIsLoading(true);
    try {
      const formData = new FormData();
      if (csrfToken) formData.append('csrf_token', csrfToken);
      formData.append('quizq-id', String(currentQuizqId));
      formData.append('exclude-question-button', 'exclude');
      await postForm(formData);
      await advanceQueue(currentQuizqId);
    } finally {
      setIsLoading(false);
    }
  }, [advanceQueue, csrfToken, currentQuestion, postForm]);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const batch = await fetchBatch(2);
      setItems(batch);
    } catch (e) {
      setError('Could not load the audio quiz. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchBatch]);

  const openModal = useCallback((images: string[], startIndex: number) => {
    setModalImages(images);
    setModalStartIndex(startIndex);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  // Build extra actions for the answer buttons drawer
  const extraActions = useMemo((): ExtraAction[] => {
    const actions: ExtraAction[] = [
      {
        key: 'exclude',
        label: 'Exclude',
        icon: <Ban className={actionStyles.iconLarge} />,
        variant: 'exclude',
        onClick: handleExclude,
      },
    ];

    if (currentQuestion?.created_by_username === currentUsername) {
      actions.push({
        key: 'edit',
        label: 'Edit Question',
        icon: <Edit className={actionStyles.iconLarge} />,
        variant: 'edit',
        href: `${editQuestionUrl}?q_id=${currentQuestion.question_id}`,
      });
    }

    return actions;
  }, [currentQuestion, currentUsername, editQuestionUrl, handleExclude]);

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
    if (!currentQuestion || questionAssets.length === 0) return;
    const wasListening = sessionStorage.getItem('audio_listening_active') === 'true';
    if (!wasListening) return;

    // Small delay to let the DOM settle before starting audio.
    const timer = setTimeout(() => {
      setQuestionActive(true);
      setQuestionPlaying(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentQuestion, questionAssets]);

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

  if (!currentQuestion) {
    return (
      <div className={styles.centerContainer}>
        <button
          type="button"
          onClick={handleStart}
          disabled={isLoading}
          className={styles.startBtn}
        >
          {isLoading ? 'Loading…' : 'Start!'}
        </button>
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
      </div>
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
      <form method="post" className={styles.quizContainer}>
        {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}
        <input type="hidden" name="quizq-id" value={currentQuestion.quizq_id} />

        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actionsSection}>
          <div id="audio-command-root" className={styles.audioCommandRoot}>
            <AudioCommandSystemComponent
              question={currentQuestion}
              answerRevealed={answerRevealed}
            />
          </div>

          {currentQuestion.pics.question_image?.some(Boolean) && (
            <ImageCarousel
              images={currentQuestion.pics.question_image}
              onImageClick={(startIndex) =>
                openModal(
                  currentQuestion.pics.question_image!.filter((p): p is string => !!p),
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
            {answerRevealed && currentQuestion.pics.answer_pics?.some(Boolean) && (
              <ImageCarousel
                images={currentQuestion.pics.answer_pics}
                onImageClick={(startIndex) =>
                  openModal(
                    currentQuestion.pics.answer_pics!.filter((p): p is string => !!p),
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
          style={{ paddingBottom: `${answerPaddingBySnap[panelSnap]}px` }}
        >
          <div className={styles.metaRow}>
            <strong>Level {currentQuestion.level_no}</strong>

            {currentQuestion.categories.map((cat) => (
              <span key={cat} className={styles.badge}>
                {cat}
              </span>
            ))}
          </div>

          <div className={styles.textBlock}>
            <MarkdownContent content={currentQuestion.question_text} />
          </div>

          {answerRevealed && (
            <div className={styles.card}>
              <h5 className={styles.cardTitle}>
                <BookOpen className={actionStyles.iconSmall} />
                The Answer
              </h5>

              <div className={styles.cardContent}>
                <MarkdownContent content={currentQuestion.answer} />
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
            onSnapChange={setPanelSnap}
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
