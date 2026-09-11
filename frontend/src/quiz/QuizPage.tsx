import { useMemo, useRef, useState, useEffect, useCallback, RefObject } from 'react';
import { AudioCommandSystemComponent } from './AudioCommandSystem';
import type { AudioCommandSystemHandle } from './AudioCommandSystem';
import { ImageCarousel } from './ImageCarousel';
import { ImageModal } from './ImageModal';
import { BookOpen, Ban, Edit, Lightbulb, PenLine, Star } from 'lucide-react';
import type { QuizPageProps } from './types';
import styles from './QuizPage.module.css';
import sharedStyles from '../styles/shared.module.css';
import {
  SlideOutButtons,
  type CompactAction,
  type ExtraAction,
  type Metrics,
  type SlideOutButtonsProps,
} from './SlideOutButtons';
import type { SlideOutButtonsHandle } from './SlideOutButtons';
import { MarkdownContent } from '../components/MarkdownContent';
import { FlagButton } from '../components/FlagButton';
import { useQuizController, type QuizController } from './useQuizController';
import { useQuizMode, type QuizMode } from './useQuizMode';
import { useFullSizedPage } from './useFullSizedPage';
import { AnswerPlayer, GetAnswerButton, ReadQuestionControl } from './AudioControls';
import { AudioPlane } from './AudioPlane';
import { CategoriesSection } from './CategoriesSection';
import { QuestionToolbar } from './QuestionToolbar';
import { AnswerDraftModal } from './modals/AnswerDraftModal';
import { CategoriesModal } from './modals/CategoriesModal';
import { HintModal } from './modals/HintModal';
import { RateModal } from './modals/RateModal';
import { useAskAi } from '../ask_ai/useAskAi';
import { AskAiPanel } from '../ask_ai/AskAiPanel';
import type { AskAiContext } from '../ask_ai/types';

/** Breathing room between the end of the answer and the docked panel. */
const PANEL_CLEARANCE = 12;

function validImages(images?: Array<string | null>): string[] {
  return images?.filter((image): image is string => Boolean(image)) ?? [];
}

interface QuizEmptyProps {
  message: string;
  categoryList?: string[];
  selectedCategories?: string[];
  onApplyCategories: (categories: string[]) => void;
}

function QuizEmpty({
  message,
  categoryList,
  selectedCategories,
  onApplyCategories,
}: QuizEmptyProps) {
  const [picking, setPicking] = useState(false);

  const selectedNormalized = (selectedCategories ?? []).map((c) => c.replace(/_/g, ' '));
  const unselected = (categoryList ?? []).filter(
    (cat) => !selectedNormalized.includes(cat),
  );

  return (
    <div className={styles.emptyContainer}>
      <p className={styles.emptyMessage}>{message}</p>

      <div className={`${sharedStyles.actionCluster} ${styles.emptyActions}`}>
        <a
          href="/quemore"
          className={`${sharedStyles.actionButton} ${sharedStyles.btnBlue}`}
        >
          Que More Questions
        </a>
        {unselected.length > 0 && (
          <button
            type="button"
            className={`${sharedStyles.actionButton} ${sharedStyles.btnSlate}`}
            onClick={() => setPicking(true)}
          >
            Select More Categories
          </button>
        )}
      </div>

      {picking && (
        <CategoriesModal
          categoryList={categoryList}
          selectedCategories={selectedCategories}
          onApply={onApplyCategories}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

export function QuizPage(props: QuizPageProps) {
  const {
    currentUsername,
    editQuestionUrl,
    categoryList,
    selectedCategories,
  } = props;

  const mode = useQuizMode();
  const fullSized = useFullSizedPage();
  const quiz = useQuizController({
    audioEnabled: mode.audioEnabled,
    autoPlay: mode.autoPlay,
  });

  const commandSystemRef = useRef<AudioCommandSystemHandle>(null);
  const slideOutRef = useRef<SlideOutButtonsHandle>(null);

  const askAiContext = useMemo<AskAiContext | null>(() => {
    const q = quiz.currentQuestion;
    if (!q) return null;
    return {
      questionId: q.question_id,
      questionText: q.question_text,
      answerText: q.answer,
      categories: q.categories ?? [],
      questionImageUrls: validImages(q.pics?.question_image),
      answerImageUrls: validImages(q.pics?.answer_pics),
    };
  }, [quiz.currentQuestion]);

  const askAi = useAskAi({
    context: askAiContext,
    answerRevealed: quiz.answerRevealed,
    onResumeListening: useCallback(() => {
      commandSystemRef.current?.resumeListening();
    }, []),
  });

  const commandHandlers = useMemo(
    () => ({
      ...quiz.commandHandlers,
      askAi: askAi.actions.start,
    }),
    [quiz.commandHandlers, askAi.actions.start],
  );

  const prevAskAiActiveRef = useRef(false);
  useEffect(() => {
    if (askAi.isActive && !prevAskAiActiveRef.current) {
      const el = document.getElementById('ask-ai-conversation-root');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.setAttribute('tabindex', '-1');
        window.setTimeout(() => el.focus({ preventScroll: true }), 50);
      }
      // A full-sized panel is a single row of verdicts with no grip to reopen
      // it by, so there it stays where it is.
      if (!fullSized) slideOutRef.current?.collapse();
    }
    prevAskAiActiveRef.current = askAi.isActive;
  }, [askAi.isActive, fullSized]);

  // Sync playback state and register Bluetooth play/pause media handlers
  useEffect(() => {
    if (!mode.audioEnabled) return;
    if (!('mediaSession' in navigator)) return;

    const isPlaying = quiz.questionPlaying || quiz.answerPlaying;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    try {
      navigator.mediaSession.setActionHandler('pause', () => {
        quiz.actions.pause();
      });
    } catch (e) {
      console.warn(e);
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (quiz.questionActive || quiz.answerActive) {
          quiz.actions.resume();
        } else {
          quiz.actions.readQuestion();
        }
      });
    } catch (e) {
      console.warn(e);
    }

    if (quiz.currentQuestion) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Question Level ${quiz.currentQuestion.level_no}`,
        artist: quiz.currentQuestion.categories.join(', ') || 'Audio Quiz',
        album: 'doSomeReps',
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.setActionHandler('play', null); } catch {}
        try { navigator.mediaSession.setActionHandler('pause', null); } catch {}
      }
    };
  }, [
    mode.audioEnabled,
    quiz.questionPlaying,
    quiz.answerPlaying,
    quiz.questionActive,
    quiz.answerActive,
    quiz.actions,
    quiz.currentQuestion,
  ]);

  /*
    Mounted ONCE per audio session. The mic + KWS worker live here and must
    never be torn down by a question change, an empty queue, or a submit.
    Quiz commands are delivered via props (commandsRef), so this component
    always sees the latest handlers without re-subscribing.

    With audio off it is not mounted at all, so the reader is never asked
    for the microphone.
  */
  const commandSystem = mode.audioEnabled ? (
    <AudioCommandSystemComponent
      commands={commandHandlers}
      commandsDisabled={quiz.isSubmitting}
      ref={commandSystemRef}
    />
  ) : null;

  const body = quiz.currentQuestion ? (
    <QuizBody
      quiz={quiz}
      mode={mode}
      fullSized={fullSized}
      currentUsername={currentUsername}
      editQuestionUrl={editQuestionUrl}
      categoryList={categoryList}
      selectedCategories={selectedCategories}
      slideOutRef={slideOutRef}
    />
  ) : quiz.queueExhausted ? (
    <QuizEmpty
      message={quiz.queueExhaustedMessage}
      categoryList={categoryList}
      selectedCategories={selectedCategories}
      onApplyCategories={quiz.actions.applyCategories}
    />
  ) : (
    <div className={styles.centerContainer}>
      {quiz.error ? (
        <p className={styles.errorText} role="alert">{quiz.error}</p>
      ) : (
        <div className={sharedStyles.spinner} role="status">
          <span className={sharedStyles.srOnly}>Loading…</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.quizContainer}>
      {fullSized ? (
        <div className={styles.pageLayout}>
          <div className={styles.readingColumn}>
            <details className={styles.categoriesDisclosure}>
              <summary className={styles.categoriesSummary}>Categories</summary>
              <CategoriesSection
                categoryList={categoryList}
                initialSelectedCategories={selectedCategories}
                onApply={quiz.actions.applyCategories}
                disabled={quiz.isSubmitting}
              />
            </details>

            {body}
          </div>

          <AudioPlane quiz={quiz} mode={mode}>{commandSystem}</AudioPlane>
        </div>
      ) : (
        <>
          {commandSystem && <div className={styles.audioCommandRoot}>{commandSystem}</div>}
          {body}
        </>
      )}

      {/* Ask AI conversation UI rendered at the bottom of the quiz page. */}
      <div id="ask-ai-conversation-root" className={styles.askAiConversationRoot}>
        <AskAiPanel state={askAi} />
      </div>
    </div>
  );
}

interface QuizBodyProps {
  quiz: QuizController;
  mode: QuizMode;
  /** Whether the page has room to lay the quiz out beside its controls. */
  fullSized: boolean;
  currentUsername: string;
  editQuestionUrl: string;
  categoryList?: string[];
  selectedCategories?: string[];
  slideOutRef: RefObject<SlideOutButtonsHandle>;
}

/** The secondary panels a question can open, one at a time. */
type OpenDialog = 'hint' | 'answerDraft' | 'rate' | null;

function QuizBody({
  quiz,
  mode,
  fullSized,
  currentUsername,
  editQuestionUrl,
  categoryList,
  selectedCategories,
  slideOutRef,
}: QuizBodyProps) {
  const currentQuestion = quiz.currentQuestion!; // guarded by the shell
  const answerRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [userRating, setUserRating] = useState(currentQuestion.user_rated);

  useEffect(() => {
    setDialog(null);
    setUserRating(currentQuestion.user_rated);
  }, [currentQuestion.quizq_id, currentQuestion.user_rated]);

  useEffect(() => {
    if (quiz.answerRevealed && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      answerRef.current.focus({ preventScroll: true });
    }
  }, [quiz.answerRevealed]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const [panelMetrics, setPanelMetrics] = useState<Metrics | null>(null);
  const onMetricsChange = useCallback((metrics: Metrics) => setPanelMetrics(metrics), []);

  // Clear the panel by exactly what it currently measures. The panel is both
  // taller on a phone and shorter once the touch tiers collapse, so a hand-tuned
  // number would be wrong on one of the two.
  const answerPadding =
    quiz.answerRevealed && panelMetrics
      ? panelMetrics[quiz.panelSnap] + PANEL_CLEARANCE
      : 0;

  const hintImages = validImages(currentQuestion.pics.hint_image);
  const isOwnQuestion = currentQuestion.created_by_username === currentUsername;
  const hasHint = Boolean(currentQuestion.hint) || hintImages.length > 0;
  /** A reader rates a question once, so the offer to rate outlives its use. */
  const hasRated = userRating !== null;

  const compactActions = useMemo((): CompactAction[] => {
    const actions: CompactAction[] = [
      {
        key: 'answerDraft',
        label: 'Your Answer',
        icon: <PenLine className={sharedStyles.buttonIcon} />,
        onClick: () => setDialog('answerDraft'),
      },
    ];

    if (!hasRated) {
      actions.push({
        key: 'rate',
        label: 'Rate',
        icon: <Star className={sharedStyles.buttonIcon} />,
        onClick: () => setDialog('rate'),
      });
    }

    if (hasHint) {
      actions.unshift({
        key: 'hint',
        label: 'Hint',
        icon: <Lightbulb className={sharedStyles.buttonIcon} />,
        onClick: () => setDialog('hint'),
      });
    }

    return actions;
  }, [hasHint, hasRated]);

  const extraActions = useMemo((): ExtraAction[] => {
    const actions: ExtraAction[] = [
      {
        key: 'exclude',
        label: 'Exclude',
        icon: <Ban className={sharedStyles.buttonIcon} />,
        variant: 'exclude',
        onClick: quiz.actions.exclude,
      },
    ];

    if (isOwnQuestion) {
      actions.push({
        key: 'edit',
        label: 'Edit Question',
        icon: <Edit className={sharedStyles.buttonIcon} />,
        variant: 'edit',
        href: `${editQuestionUrl}?q_id=${currentQuestion.question_id}`,
      });
    }

    return actions;
  }, [currentQuestion, isOwnQuestion, editQuestionUrl, quiz.actions.exclude]);

  /*
   * A full-sized page gives every secondary control a home of its own — the
   * toolbar beside the level, the answer field, the audio plane, the category
   * disclosure — so the panel is left holding the one thing it is for.
   */
  const panelExtras: SlideOutButtonsProps = fullSized
    ? {}
    : {
        extraActions,
        compactActions,
        showCategories: true,
        categoryList,
        initialSelectedCategories: selectedCategories,
        onApplyCategories: quiz.actions.applyCategories,
        questionId: currentQuestion.question_id,
        author: {
          id: currentQuestion.created_by_id,
          username: currentQuestion.created_by_username,
          isSelf: isOwnQuestion,
        },
        initialFlag: currentQuestion.flag,
        onFlagChange: quiz.actions.setFlag,
        audioEnabled: mode.audioEnabled,
        onToggleAudioEnabled: mode.toggleAudioEnabled,
        autoPlay: mode.autoPlay,
        onToggleAutoPlay: mode.toggleAutoPlay,
      };

  const questionImages = validImages(currentQuestion.pics.question_image);
  const answerImages = validImages(currentQuestion.pics.answer_pics);

  return (
    <>
      {quiz.modalOpen && (
        <ImageModal
          images={quiz.modalImages}
          startIndex={quiz.modalStartIndex}
          onClose={quiz.actions.closeModal}
          onCorrect={quiz.actions.correct}
          onWrong={quiz.actions.wrong}
          onSlightlyWrong={quiz.actions.slightlyWrong}
        />
      )}

      {dialog === 'hint' && (
        <HintModal
          hint={currentQuestion.hint}
          images={hintImages}
          assets={mode.audioEnabled ? quiz.hintAssets : []}
          onClose={closeDialog}
        />
      )}

      {dialog === 'answerDraft' && (
        <AnswerDraftModal
          value={quiz.providedAnswer}
          onSave={quiz.actions.setProvidedAnswer}
          onClose={closeDialog}
        />
      )}

      {dialog === 'rate' && (
        <RateModal
          quizqId={currentQuestion.quizq_id}
          averageRating={currentQuestion.rating}
          userRating={userRating}
          onRated={setUserRating}
          onClose={closeDialog}
        />
      )}

      <div>
        {quiz.error && (
          <p className={styles.errorText} role="alert">{quiz.error}</p>
        )}

        <div className={styles.actionsSection}>
          {questionImages.length > 0 && (
            <ImageCarousel
              images={questionImages}
              onImageClick={(startIndex) => quiz.actions.openModal(questionImages, startIndex)}
            />
          )}

          {/* On a full-sized page the audio plane holds these instead. */}
          {!fullSized && mode.audioEnabled && <ReadQuestionControl quiz={quiz} />}

          <div className={styles.middleSection}>
            {quiz.answerRevealed && answerImages.length > 0 && (
              <ImageCarousel
                images={answerImages}
                onImageClick={(startIndex) => quiz.actions.openModal(answerImages, startIndex)}
              />
            )}

            {!fullSized && !quiz.answerRevealed && <GetAnswerButton quiz={quiz} />}

            {!fullSized && mode.audioEnabled && quiz.answerActive && (
              <AnswerPlayer quiz={quiz} />
            )}
          </div>
        </div>

        <div
          className={styles.contentDivider}
          style={{ paddingBottom: `${answerPadding}px` }}
        >
          <div className={styles.metaRow}>
            <strong>Level {currentQuestion.level_no}</strong>
            {currentQuestion.categories.map((cat) => (
              <span key={cat} className={styles.badge}>{cat}</span>
            ))}

            {fullSized ? (
              <QuestionToolbar
                question={currentQuestion}
                isOwnQuestion={isOwnQuestion}
                editQuestionUrl={editQuestionUrl}
                disabled={quiz.isSubmitting}
                onHint={hasHint ? () => setDialog('hint') : undefined}
                onRate={hasRated ? undefined : () => setDialog('rate')}
                onExclude={quiz.actions.exclude}
                onFlagChange={quiz.actions.setFlag}
              />
            ) : (
              currentQuestion.flag && (
                <FlagButton
                  questionId={currentQuestion.question_id}
                  initialFlag={currentQuestion.flag}
                  onFlagChange={quiz.actions.setFlag}
                  compact={true}
                />
              )
            )}
          </div>

          <div className={styles.textBlock}>
            <MarkdownContent content={currentQuestion.question_text} />
          </div>

          {/* A phone writes its answer in a dialog, for want of the room. */}
          {fullSized && (
            <div className={styles.answerDraft}>
              <label className={styles.answerLabel} htmlFor="quiz-answer-draft">
                Your Answer
              </label>
              <textarea
                id="quiz-answer-draft"
                className={styles.answerField}
                rows={2}
                value={quiz.providedAnswer}
                onChange={(event) => quiz.actions.setProvidedAnswer(event.target.value)}
                placeholder="Write your answer before revealing the real one."
              />
              {!quiz.answerRevealed && <GetAnswerButton quiz={quiz} />}
            </div>
          )}

          {quiz.answerRevealed && (
            <div ref={answerRef} tabIndex={-1} className={styles.card}>
              <h5 className={styles.cardTitle}>
                <BookOpen className={styles.cardTitleIcon} />
                The Answer
              </h5>
              <div className={styles.cardContent}>
                <MarkdownContent content={currentQuestion.answer} />
              </div>
            </div>
          )}
        </div>

        {quiz.answerRevealed && (
          <SlideOutButtons
            ref={slideOutRef}
            disabled={quiz.isSubmitting}
            onCorrect={quiz.actions.correct}
            onWrong={quiz.actions.wrong}
            onSlightlyWrong={quiz.actions.slightlyWrong}
            onSnapChange={quiz.actions.setPanelSnap}
            onMetricsChange={onMetricsChange}
            expandToTrio
            {...panelExtras}
          />
        )}
      </div>
    </>
  );
}
