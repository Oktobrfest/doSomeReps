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
import type { AudioQuizProps } from './types';
import styles from './AudioQuiz.module.css';
import actionStyles from './ActionButton.module.css';
import { SlideOutButtons, type ExtraAction } from './SlideOutButtons';
import { MarkdownContent } from '../components/MarkdownContent';
import { useAudioQuizController } from './useAudioQuizController';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface LargeActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { }

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

const answerPaddingBySnap: Record<'collapsed' | 'trio' | 'full', number> = {
  collapsed: 12,
  trio: 188,
  full: 340,
};

function validImages(images?: Array<string | null>): string[] {
  return images?.filter((image): image is string => Boolean(image)) ?? [];
}

export function AudioQuiz({
  initialItems = [],
  currentUsername,
  editQuestionUrl,
  csrfToken,
  categoryList,
  selectedCategories,
}: AudioQuizProps) {
  const quiz = useAudioQuizController({
    initialItems,
    csrfToken,
  });

  const currentQuestion = quiz.currentQuestion;

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
  }, [currentQuestion, currentUsername, editQuestionUrl, quiz.actions.exclude]);

  if (!currentQuestion) {
    return (
      <div className={styles.centerContainer}>
        {quiz.error ? (
          <p className={styles.errorText} role="alert">
            {quiz.error}
          </p>
        ) : (
          <div className={styles.spinner} role="status">
            <span className="sr-only">Loading…</span>
          </div>
        )}
      </div>
    );
  }

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

      <form method="post" className={styles.quizContainer}>
        {csrfToken && <input type="hidden" name="csrf_token" value={csrfToken} />}
        <input type="hidden" name="quizq-id" value={currentQuestion.quizq_id} />

        {quiz.error && (
          <p className={styles.errorText} role="alert">
            {quiz.error}
          </p>
        )}

        <div className={styles.actionsSection}>
          <div className={styles.audioCommandRoot}>
            <AudioCommandSystemComponent
              question={currentQuestion}
              answerRevealed={quiz.answerRevealed}
              commands={quiz.commandHandlers}
              commandsDisabled={quiz.isSubmitting}
            />
          </div>

          {questionImages.length > 0 && (
            <ImageCarousel
              images={questionImages}
              onImageClick={(startIndex) => {
                quiz.actions.openModal(questionImages, startIndex);
              }}
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
                onImageClick={(startIndex) => {
                  quiz.actions.openModal(answerImages, startIndex);
                }}
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
              <span key={cat} className={styles.badge}>
                {cat}
              </span>
            ))}
          </div>

          <div className={styles.textBlock}>
            <MarkdownContent content={currentQuestion.question_text} />
          </div>

          {quiz.answerRevealed && (
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

        <div className={styles.askAiConversationRoot}></div>
      </form>
    </>
  );
}