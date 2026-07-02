import { useMemo, useRef, useEffect } from 'react';
import { AudioCommandSystemComponent } from './AudioCommandSystem';
import { ImageCarousel } from './ImageCarousel';
import { ImageModal } from './ImageModal';
import { Volume2, BookOpen, Ban, Edit } from 'lucide-react';
import type { AudioQuizProps } from './types';
import styles from './AudioQuiz.module.css';
import actionStyles from './ActionButton.module.css';
import { SlideOutButtons, type ExtraAction } from './SlideOutButtons';
import { MarkdownContent } from '../components/MarkdownContent';
import { useAudioQuizController } from './useAudioQuizController';
import { LargeActionButton, LargePlayableControl } from './AudioControls';

const answerPaddingBySnap: Record<'collapsed' | 'trio' | 'full', number> = {
  collapsed: 12,
  trio: 188,
  full: 340,
};

function validImages(images?: Array<string | null>): string[] {
  return images?.filter((image): image is string => Boolean(image)) ?? [];
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
          question={quiz.currentQuestion}
          answerRevealed={quiz.answerRevealed}
          commands={quiz.commandHandlers}
          commandsDisabled={quiz.isSubmitting}
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

      {/* Stable portal target for the command system's Ask-AI UI. */}
      <div id="ask-ai-conversation-root" className={styles.askAiConversationRoot} />
    </div>
  );
}

interface AudioQuizBodyProps {
  quiz: ReturnType<typeof useAudioQuizController>;
  currentUsername: string;
  editQuestionUrl: string;
  categoryList?: string[];
  selectedCategories?: string[];
}

function AudioQuizBody({
  quiz,
  currentUsername,
  editQuestionUrl,
  categoryList,
  selectedCategories,
}: AudioQuizBodyProps) {
  const currentQuestion = quiz.currentQuestion!; // guarded by the shell
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quiz.answerRevealed && answerRef.current) {
      answerRef.current.focus();
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
          />
        )}
      </form>
    </>
  );
}