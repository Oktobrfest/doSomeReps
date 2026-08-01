import { useMemo, useRef, useEffect, useCallback, RefObject } from 'react';
import { AudioCommandSystemComponent } from './AudioCommandSystem';
import type { AudioCommandSystemHandle } from './AudioCommandSystem';
import { ImageCarousel } from './ImageCarousel';
import { ImageModal } from './ImageModal';
import { Volume2, BookOpen, Ban, Edit } from 'lucide-react';
import type { AudioQuizProps } from './types';
import styles from './AudioQuiz.module.css';
import actionStyles from './ActionButton.module.css';
import { SlideOutButtons, type ExtraAction } from './SlideOutButtons';
import type { SlideOutButtonsHandle } from './SlideOutButtons';
import { MarkdownContent } from '../components/MarkdownContent';
import { FlagButton } from '../components/FlagButton';
import { useAudioQuizController } from './useAudioQuizController';
import { LargeActionButton, LargePlayableControl } from './AudioControls';
import { useAskAi } from '../ask_ai/useAskAi';
import { AskAiPanel } from '../ask_ai/AskAiPanel';
import type { AskAiContext } from '../ask_ai/types';

const answerPaddingBySnap: Record<'collapsed' | 'trio' | 'full', number> = {
  collapsed: 12,
  trio: 188,
  full: 340,
};

function validImages(images?: Array<string | null>): string[] {
  return images?.filter((image): image is string => Boolean(image)) ?? [];
}

interface AudioQuizEmptyProps {
  message: string;
  categoryList?: string[];
  selectedCategories?: string[];
}

function AudioQuizEmpty({ message, categoryList, selectedCategories }: AudioQuizEmptyProps) {
  const selectedNormalized = (selectedCategories ?? []).map((c) => c.replace(/_/g, ' '));
  const unselected = (categoryList ?? []).filter(
    (cat) => !selectedNormalized.includes(cat),
  );

  return (
    <div className={styles.centerContainer} style={{ flexDirection: 'column', gap: '24px', textAlign: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '560px' }}>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.7', margin: 0 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <a
          href="/quemore"
          className={styles.secondaryBtn}
        >
          Que More Questions
        </a>
        {unselected.length > 0 && (
          <a
            href="/select_categories"
            className={styles.secondaryBtn}
          >
            Select More Categories
          </a>
        )}
      </div>
    </div>
  );
}

export function AudioQuiz(props: AudioQuizProps) {
  const {
    currentUsername,
    editQuestionUrl,
    csrfToken,
    categoryList,
    selectedCategories,
    initialItems = [],
  } = props;

  const quiz = useAudioQuizController({ initialItems, csrfToken });

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
      csrfToken,
    };
  }, [quiz.currentQuestion, csrfToken]);

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
      slideOutRef.current?.collapse();
    }
    prevAskAiActiveRef.current = askAi.isActive;
  }, [askAi.isActive]);

  // Sync playback state and register Bluetooth play/pause media handlers
  useEffect(() => {
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
    quiz.questionPlaying,
    quiz.answerPlaying,
    quiz.questionActive,
    quiz.answerActive,
    quiz.actions,
    quiz.currentQuestion,
  ]);

  return (
    <div className={styles.quizContainer}>
      {/*
        Mounted ONCE for the session. The mic + KWS worker live here and must
        never be torn down by a question change, an empty queue, or a submit.
        Quiz commands are delivered via props (commandsRef), so this component
        always sees the latest handlers without re-subscribing.
      */}
      <div className={styles.audioCommandRoot}>
        <AudioCommandSystemComponent
          commands={commandHandlers}
          commandsDisabled={quiz.isSubmitting}
          ref={commandSystemRef}
        />
      </div>

      {/*
        CSRF lives in the shell so getCsrfToken() in the command system still
        resolves it even while the body is showing the loading spinner.
      */}
      {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}

      {quiz.currentQuestion ? (
        <AudioQuizBody
          quiz={quiz}
          currentUsername={currentUsername}
          editQuestionUrl={editQuestionUrl}
          categoryList={categoryList}
          selectedCategories={selectedCategories}
          slideOutRef={slideOutRef}
          csrfToken={csrfToken}
        />
      ) : quiz.queueExhausted ? (
        <AudioQuizEmpty
          message={quiz.queueExhaustedMessage}
          categoryList={categoryList}
          selectedCategories={selectedCategories}
        />
      ) : (
        <div className={styles.centerContainer}>
          {quiz.error ? (
            <p className={styles.errorText} role="alert">{quiz.error}</p>
          ) : (
            <div className={styles.spinner} role="status">
              <span className="sr-only">Loading…</span>
            </div>
          )}
        </div>
      )}

      {/* Ask AI conversation UI rendered at the bottom of the quiz page. */}
      <div id="ask-ai-conversation-root" className={styles.askAiConversationRoot}>
        <AskAiPanel state={askAi} />
      </div>
    </div>
  );
}

interface AudioQuizBodyProps {
  quiz: ReturnType<typeof useAudioQuizController>;
  currentUsername: string;
  editQuestionUrl: string;
  categoryList?: string[];
  selectedCategories?: string[];
  slideOutRef: RefObject<SlideOutButtonsHandle>;
  csrfToken?: string;
}

function AudioQuizBody({
  quiz,
  currentUsername,
  editQuestionUrl,
  categoryList,
  selectedCategories,
  slideOutRef,
  csrfToken,
}: AudioQuizBodyProps) {
  const currentQuestion = quiz.currentQuestion!; // guarded by the shell
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quiz.answerRevealed && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      answerRef.current.focus({ preventScroll: true });
    }
  }, [quiz.answerRevealed]);

  const extraActions = useMemo((): ExtraAction[] => {
    const actions: ExtraAction[] = [
      {
        key: 'exclude',
        label: 'Exclude',
        icon: <Ban className={actionStyles.iconLarge} />,
        variant: 'exclude',
        onClick: quiz.actions.exclude,
      },
    ];

    if (currentQuestion.created_by_username === currentUsername) {
      actions.push({
        key: 'edit',
        label: 'Edit Question',
        icon: <Edit className={actionStyles.iconLarge} />,
        variant: 'edit',
        href: `${editQuestionUrl}?q_id=${currentQuestion.question_id}`,
      });
    }

    return actions;
  }, [currentQuestion, currentUsername, editQuestionUrl, quiz.actions.exclude]);

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

      <form method="post">
        <input type="hidden" name="quizq-id" value={currentQuestion.quizq_id} />

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

          {quiz.questionActive ? (
            <LargePlayableControl
              onClick={quiz.actions.readQuestion}
              isPlaying={quiz.questionPlaying}
              className={actionStyles.orangeBtn}
              assets={quiz.questionAssets}
              onSequenceEnd={quiz.actions.questionEnded}
            />
          ) : (
            <LargeActionButton
              onClick={quiz.actions.readQuestion}
              disabled={quiz.questionAssets.length === 0 || quiz.isSubmitting}
              className={actionStyles.orangeBtn}
            >
              <div className={actionStyles.btnContent}>
                <Volume2 className={actionStyles.iconLarge} />
                <span>Read Question</span>
              </div>
            </LargeActionButton>
          )}

          <div className={styles.middleSection}>
            {quiz.answerRevealed && answerImages.length > 0 && (
              <ImageCarousel
                images={answerImages}
                onImageClick={(startIndex) => quiz.actions.openModal(answerImages, startIndex)}
              />
            )}

            {!quiz.answerRevealed && (
              <LargeActionButton
                id="audio-get-answer-btn"
                onClick={quiz.actions.getAnswer}
                disabled={quiz.isSubmitting}
                className={actionStyles.blueBtn}
              >
                <div className={actionStyles.btnContent}>
                  <BookOpen className={actionStyles.iconLarge} />
                  <span>Get Answer</span>
                </div>
              </LargeActionButton>
            )}

            {quiz.answerActive && (
              <LargePlayableControl
                onClick={quiz.actions.toggleAnswerAudio}
                isPlaying={quiz.answerPlaying}
                className={actionStyles.blueBtn}
                assets={quiz.answerAssets}
                onSequenceEnd={quiz.actions.answerEnded}
              />
            )}
          </div>
        </div>

        <div
          className={styles.contentDivider}
          style={{ paddingBottom: `${answerPaddingBySnap[quiz.panelSnap]}px` }}
        >
          <div className={styles.metaRow}>
            <strong>Level {currentQuestion.level_no}</strong>
            {currentQuestion.categories.map((cat) => (
              <span key={cat} className={styles.badge}>{cat}</span>
            ))}
            {currentQuestion.flag && (
              <FlagButton
                questionId={currentQuestion.question_id}
                initialFlag={currentQuestion.flag}
                csrfToken={csrfToken}
                onFlagChange={quiz.actions.setFlag}
                compact={true}
              />
            )}
          </div>

          <div className={styles.textBlock}>
            <MarkdownContent content={currentQuestion.question_text} />
          </div>

          {quiz.answerRevealed && (
            <div
              ref={answerRef}
              tabIndex={-1}
              className={styles.card}
              style={{ outline: 'none' }}
            >
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

        {quiz.answerRevealed && (
          <SlideOutButtons
            ref={slideOutRef}
            disabled={quiz.isSubmitting}
            onCorrect={quiz.actions.correct}
            onWrong={quiz.actions.wrong}
            onSlightlyWrong={quiz.actions.slightlyWrong}
            extraActions={extraActions}
            onSnapChange={quiz.actions.setPanelSnap}
            expandToTrio
            showCategories
            categoryList={categoryList}
            initialSelectedCategories={selectedCategories}
            questionId={currentQuestion.question_id}
            initialFlag={currentQuestion.flag}
            csrfToken={csrfToken}
            onFlagChange={quiz.actions.setFlag}
          />
        )}
      </form>
    </>
  );
}
