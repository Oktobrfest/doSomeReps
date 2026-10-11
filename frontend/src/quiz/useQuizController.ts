import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { jsonHeaders } from '../lib/http';
import { resolveCategoryNames, toSlug } from '../lib/categories';
import type {
  AudioAssets,
  QuizCommandHandlers,
  QuizBatchResponse,
  QuizItem,
} from './types';

type PanelSnap = 'collapsed' | 'trio' | 'full';
type AudioSource = 'question' | 'answer' | 'hint' | null;
type VerdictKind = 'correct' | 'wrong' | 'slightlyWrong';

interface ModalState {
  open: boolean;
  images: string[];
  startIndex: number;
}

interface QuizUiState {
  isSubmitting: boolean;
  error: string | null;
  answerRevealed: boolean;
  activeAudio: AudioSource;
  audioPlaying: boolean;
  modal: ModalState;
  panelSnap: PanelSnap;
  queueExhausted: boolean;
  queueExhaustedMessage: string;
}

type QuizUiAction =
  | { type: 'QUEUE_LOADING' }
  | { type: 'SUBMIT_STARTED' }
  | { type: 'SUBMIT_FINISHED' }
  | { type: 'SUBMIT_FAILED'; message: string }
  | { type: 'QUEUE_FETCH_FAILED'; message: string }
  | { type: 'QUEUE_EXHAUSTED'; message: string }
  | { type: 'QUESTION_CHANGED' }
  | { type: 'QUESTION_AUDIO_TOGGLE_OR_START' }
  | { type: 'QUESTION_AUDIO_ENDED' }
  | { type: 'HINT_AUDIO_TOGGLE_OR_START' }
  | { type: 'HINT_AUDIO_ENDED' }
  | { type: 'ANSWER_REVEALED'; playAudio: boolean }
  | { type: 'ANSWER_AUDIO_TOGGLED' }
  | { type: 'ANSWER_AUDIO_ENDED' }
  | { type: 'PAUSE_AUDIO' }
  | { type: 'RESUME_AUDIO' }
  | { type: 'STOP_AUDIO' }
  | { type: 'OPEN_MODAL'; images: string[]; startIndex: number }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_PANEL_SNAP'; snap: PanelSnap };

type QuizActionRequest =
  | {
      action: 'submit';
      quizqId: string | number;
      verdict: string;
      providedAnswer?: string | null;
    }
  | {
      action: 'exclude';
      quizqId: string | number;
    };

const QUEUE_TARGET_SIZE = 2;

/** The queue always starts empty: the page fetches it once it knows the mode. */
const NO_ITEMS: QuizItem[] = [];
const categoryKey = (categories: string[]) => categories.map(toSlug).sort().join('\u0000');

const initialUiState: QuizUiState = {
  isSubmitting: false,
  error: null,
  answerRevealed: false,
  activeAudio: null,
  audioPlaying: false,
  modal: {
    open: false,
    images: [],
    startIndex: 0,
  },
  panelSnap: 'collapsed',
  queueExhausted: false,
  queueExhaustedMessage: '',
};

function reducer(state: QuizUiState, action: QuizUiAction): QuizUiState {
  switch (action.type) {
    case 'QUEUE_LOADING':
      return { ...state, error: null, queueExhausted: false, queueExhaustedMessage: '' };

    case 'SUBMIT_STARTED':
      return {
        ...state,
        isSubmitting: true,
        error: null,
        activeAudio: null,
        audioPlaying: false,
        modal: {
          ...state.modal,
          open: false,
        },
      };

    case 'SUBMIT_FINISHED':
      return {
        ...state,
        isSubmitting: false,
      };

    case 'SUBMIT_FAILED':
      return {
        ...state,
        isSubmitting: false,
        error: action.message,
        activeAudio: null,
        audioPlaying: false,
      };

    case 'QUEUE_FETCH_FAILED':
      return {
        ...state,
        error: action.message,
      };

    case 'QUESTION_CHANGED':
      return {
        ...state,
        answerRevealed: false,
        activeAudio: null,
        audioPlaying: false,
        modal: {
          ...state.modal,
          open: false,
        },
        panelSnap: 'collapsed',
      };

    case 'QUESTION_AUDIO_TOGGLE_OR_START':
      if (state.isSubmitting) return state;

      if (state.activeAudio === 'question') {
        return {
          ...state,
          audioPlaying: !state.audioPlaying,
        };
      }

      return {
        ...state,
        answerRevealed: state.activeAudio === 'answer' ? false : state.answerRevealed,
        activeAudio: 'question',
        audioPlaying: true,
      };

    case 'QUESTION_AUDIO_ENDED':
      if (state.activeAudio !== 'question') return state;
      return {
        ...state,
        activeAudio: null,
        audioPlaying: false,
      };

    case 'HINT_AUDIO_TOGGLE_OR_START':
      if (state.isSubmitting) return state;
      return {
        ...state,
        // Like rereading the question, returning to the hint offers Get Answer again.
        answerRevealed: state.activeAudio === 'answer' ? false : state.answerRevealed,
        activeAudio: 'hint',
        audioPlaying: state.activeAudio === 'hint' ? !state.audioPlaying : true,
      };

    case 'HINT_AUDIO_ENDED':
      if (state.activeAudio !== 'hint') return state;
      return { ...state, audioPlaying: false };

    case 'ANSWER_REVEALED':
      if (state.isSubmitting) return state;

      return {
        ...state,
        answerRevealed: true,
        activeAudio: action.playAudio ? 'answer' : null,
        audioPlaying: action.playAudio,
      };

    case 'ANSWER_AUDIO_TOGGLED':
      if (state.isSubmitting || state.activeAudio !== 'answer') return state;
      return {
        ...state,
        audioPlaying: !state.audioPlaying,
      };

    case 'ANSWER_AUDIO_ENDED':
      if (state.activeAudio !== 'answer') return state;
      return {
        ...state,
        audioPlaying: false,
      };

    case 'PAUSE_AUDIO':
      return {
        ...state,
        audioPlaying: false,
      };

    case 'RESUME_AUDIO':
      if (state.isSubmitting || !state.activeAudio) return state;
      return {
        ...state,
        audioPlaying: true,
      };

    case 'STOP_AUDIO':
      return {
        ...state,
        activeAudio: null,
        audioPlaying: false,
      };

    case 'OPEN_MODAL':
      return {
        ...state,
        modal: {
          open: true,
          images: action.images,
          startIndex: action.startIndex,
        },
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modal: {
          ...state.modal,
          open: false,
        },
      };

    case 'SET_PANEL_SNAP':
      return {
        ...state,
        panelSnap: action.snap,
      };

    case 'QUEUE_EXHAUSTED':
      return {
        ...state,
        queueExhausted: true,
        queueExhaustedMessage: action.message,
        activeAudio: null,
        audioPlaying: false,
      };

    default:
      return state;
  }
}

function getQuizqId(item: QuizItem): string | number | null {
  return item.question?.quizq_id ?? null;
}

function getAudioAssets(item: QuizItem | null): AudioAssets {
  return item?.audioAssets ?? {};
}

function dedupeItems(baseItems: QuizItem[], incomingItems: QuizItem[]): QuizItem[] {
  const seen = new Set(
    baseItems
      .map(getQuizqId)
      .filter((id): id is string | number => id != null)
      .map(String),
  );

  const dedupedIncoming = incomingItems.filter((item) => {
    const id = getQuizqId(item);
    if (id == null) return true;

    const key = String(id);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  return [...baseItems, ...dedupedIncoming];
}

function verdictToServerValue(verdict: VerdictKind): string {
  switch (verdict) {
    case 'correct':
      return 'Correct!';
    case 'wrong':
      return 'Wrong!';
    case 'slightlyWrong':
      return 'Slightly Wrong';
    default:
      verdict satisfies never;
      return '';
  }
}

/** The quiz state and every action the page drives it with. */
export type QuizController = ReturnType<typeof useQuizController>;

interface UseQuizControllerOptions {
  initialSelectedCategories?: string[];
  categoryList?: string[];
  /** When false the queue is fetched without audio and nothing ever plays. */
  audioEnabled: boolean;
  /** Start reading each new question aloud. Only consulted while audio is on. */
  autoPlay: boolean;
}

export function useQuizController({
  audioEnabled,
  autoPlay,
  initialSelectedCategories = [],
  categoryList = [],
}: UseQuizControllerOptions) {
  const [selectedCategories, setSelectedCategories] = useState(() =>
    resolveCategoryNames(initialSelectedCategories, categoryList),
  );
  const categoriesRef = useRef(selectedCategories);
  const categoriesOpenRef = useRef(false);
  const queueDirtyRef = useRef(false);
  const savedCategoriesRef = useRef(categoryKey(selectedCategories));
  const categorySaveRef = useRef(Promise.resolve());
  const queueVersionRef = useRef(0);
  const queueRequestRef = useRef<AbortController | null>(null);
  const [items, setItems] = useReducer(
    (_previous: QuizItem[], next: QuizItem[]) => next,
    NO_ITEMS,
  );

  const [ui, dispatch] = useReducer(reducer, initialUiState);

  const itemsRef = useRef<QuizItem[]>(NO_ITEMS);
  const currentItemRef = useRef<QuizItem | null>(null);
  const uiRef = useRef<QuizUiState>(initialUiState);
  const submitInFlightRef = useRef(false);

  const currentItem = items[0] ?? null;
  const currentQuestion = currentItem?.question ?? null;

  const questionAssets = useMemo(
    () => getAudioAssets(currentItem).question ?? [],
    [currentItem],
  );

  const answerAssets = useMemo(
    () => getAudioAssets(currentItem).answer ?? [],
    [currentItem],
  );

  const hintAssets = useMemo(
    () => getAudioAssets(currentItem).hint ?? [],
    [currentItem],
  );

  const commitItems = useCallback((nextItems: QuizItem[]) => {
    itemsRef.current = nextItems;
    currentItemRef.current = nextItems[0] ?? null;
    setItems(nextItems);
  }, []);

  useLayoutEffect(() => {
    itemsRef.current = items;
    currentItemRef.current = items[0] ?? null;
  }, [items]);

  useLayoutEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const stopAllAudio = useCallback(() => {
    const callbacks = window.__audioStopCallbacks;
    if (!Array.isArray(callbacks)) return;

    callbacks.forEach((callback) => {
      try {
        callback?.();
      } catch {
        // A failed cleanup callback should never block a primary quiz action.
      }
    });
  }, []);

  useEffect(() => {
    const stopMe = () => {
      dispatch({ type: 'PAUSE_AUDIO' });
    };

    if (!window.__audioStopCallbacks) {
      window.__audioStopCallbacks = [];
    }

    window.__audioStopCallbacks.push(stopMe);

    return () => {
      const callbacks = window.__audioStopCallbacks;
      if (!callbacks) return;

      const index = callbacks.indexOf(stopMe);
      if (index >= 0) callbacks.splice(index, 1);
    };
  }, []);

  const audioEnabledRef = useRef(audioEnabled);
  useLayoutEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const fetchBatch = useCallback(
    async (count: number, excludeQuizqIds: Array<string | number>, signal: AbortSignal) => {
      const params = new URLSearchParams();
      params.set('count', String(count));
      params.set('audio', audioEnabledRef.current ? '1' : '0');

      if (excludeQuizqIds.length > 0) {
        params.set('exclude_quizq_ids', excludeQuizqIds.map(String).join(','));
      }

      const response = await fetch(`/quiz/queue?${params.toString()}`, {
        credentials: 'same-origin',
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load quiz questions (${response.status})`);
      }

      const data = (await response.json()) as QuizBatchResponse;
      return data;
    },
    [],
  );

  const postQuizAction = useCallback(
    async (body: QuizActionRequest) => {
      const response = await fetch('/quiz/api/action', {
        method: 'POST',
        headers: jsonHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || `Quiz action failed (${response.status})`);
      }

      return result;
    },
    [],
  );

  const cancelQueueRequest = useCallback(() => {
    queueVersionRef.current += 1;
    queueRequestRef.current?.abort();
    queueRequestRef.current = null;
  }, []);

  /** Serialize selection writes and ignore reads superseded by a newer selection or verdict. */
  const refreshQueue = useCallback(async (submittedQuizqId?: string | number) => {
    queueDirtyRef.current = true;
    if (submitInFlightRef.current) return;
    if (categoriesOpenRef.current && currentItemRef.current) return;

    cancelQueueRequest();
    const version = queueVersionRef.current;
    const request = new AbortController();
    queueRequestRef.current = request;
    const categories = categoriesRef.current.map(toSlug).sort();
    const key = categories.join('\u0000');
    const isCurrent = () => version === queueVersionRef.current;
    dispatch({ type: 'QUEUE_LOADING' });

    // A cancelled browser request can still write on the server. Complete each
    // category write before starting the next; skip intermediate selections.
    const save = categorySaveRef.current.catch(() => {}).then(async () => {
      if (!isCurrent() || key === savedCategoriesRef.current) return;
      const response = await fetch('/quiz/api/categories', {
        method: 'POST',
        headers: jsonHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ categories }),
      });
      if (!response.ok) throw new Error('Could not save your categories. Please try again.');
      savedCategoriesRef.current = key;
    });
    categorySaveRef.current = save;

    try {
      await save;
      if (!isCurrent()) return;
      const currentItems = itemsRef.current;
      const count = Math.max(0, QUEUE_TARGET_SIZE - currentItems.length);
      if (count === 0) {
        queueDirtyRef.current = false;
        return;
      }
      const excluded = currentItems.map(getQuizqId).filter((id): id is string | number => id != null);
      if (submittedQuizqId != null) excluded.push(submittedQuizqId);
      const data = await fetchBatch(count, excluded, request.signal);
      if (!isCurrent()) return;
      queueDirtyRef.current = false;
      const next = dedupeItems(itemsRef.current, data.items ?? []);
      commitItems(next);
      if (next.length === 0 && data.queueExhausted) {
        dispatch({ type: 'QUEUE_EXHAUSTED', message: data.message || 'No more questions are available.' });
      }
    } catch (error) {
      if (!isCurrent()) return;
      dispatch({
        type: 'QUEUE_FETCH_FAILED',
        message: savedCategoriesRef.current !== key && error instanceof Error
          ? error.message
          : 'Could not load quiz questions. Please try again.',
      });
    } finally {
      if (isCurrent()) queueRequestRef.current = null;
    }
  }, [cancelQueueRequest, commitItems, fetchBatch]);

  const changeCategories = useCallback((categories: string[]) => {
    if (categoryKey(categories) === categoryKey(categoriesRef.current)) return;
    categoriesRef.current = categories;
    setSelectedCategories(categories);
    queueDirtyRef.current = true;
    cancelQueueRequest();
    const selected = new Set(categories.map(toSlug));
    const matching = itemsRef.current.filter((item) =>
      item.question?.categories.some((name) => selected.has(toSlug(name))),
    ).slice(0, 1);
    if (matching[0] !== currentItemRef.current) stopAllAudio();
    commitItems(matching);
    void refreshQueue();
  }, [cancelQueueRequest, commitItems, refreshQueue, stopAllAudio]);

  const setCategoriesOpen = useCallback((open: boolean) => {
    categoriesOpenRef.current = open;
    if (!open && queueDirtyRef.current && !queueRequestRef.current) void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    void refreshQueue();
    return cancelQueueRequest;
  }, [cancelQueueRequest, refreshQueue]);

  const submitCurrentQuestion = useCallback(
    async (
      action:
        | { type: 'submit'; verdict: VerdictKind }
        | { type: 'exclude' },
    ) => {
      if (submitInFlightRef.current) return;

      const q = currentItemRef.current?.question;
      if (!q) return;

      const submittedQuizqId = q.quizq_id;
      const previousItems = itemsRef.current;
      const providedAnswer = providedAnswerRef.current;
      let submitted = false;

      const itemsAfterRemoval = previousItems.filter((item) => {
        const id = getQuizqId(item);
        return id == null || String(id) !== String(submittedQuizqId);
      });

      cancelQueueRequest();
      submitInFlightRef.current = true;
      stopAllAudio();

      /*
       * Critical SPA behavior:
       * show the already-queued next question immediately.
       * Do not wait for POST.
       * Do not wait for /quiz/queue.
       * Do not wait for audio prep.
       */
      flushSync(() => {
        commitItems(itemsAfterRemoval);
        dispatch({ type: 'SUBMIT_STARTED' });
      });

      try {
        if (action.type === 'exclude') {
          await postQuizAction({
            action: 'exclude',
            quizqId: submittedQuizqId,
          });
        } else {
          await postQuizAction({
            action: 'submit',
            quizqId: submittedQuizqId,
            verdict: verdictToServerValue(action.verdict),
            providedAnswer: providedAnswer || null,
          });
        }

        submitted = true;
      } catch {
        const selected = new Set(categoriesRef.current.map(toSlug));
        commitItems(previousItems.filter((item) =>
          item.question?.categories.some((name) => selected.has(toSlug(name))),
        ));

        dispatch({
          type: 'SUBMIT_FAILED',
          message: 'Could not submit this answer. Please try again.',
        });
      } finally {
        submitInFlightRef.current = false;
        dispatch({ type: 'SUBMIT_FINISHED' });
        if (submitted || (queueDirtyRef.current && !currentItemRef.current)) {
          void refreshQueue(submittedQuizqId);
        }
      }
    },
    [cancelQueueRequest, commitItems, postQuizAction, stopAllAudio, refreshQueue],
  );

  const submitVerdict = useCallback(
    (verdict: VerdictKind) => {
      void submitCurrentQuestion({
        type: 'submit',
        verdict,
      });
    },
    [submitCurrentQuestion],
  );

  const excludeCurrentQuestion = useCallback(() => {
    void submitCurrentQuestion({
      type: 'exclude',
    });
  }, [submitCurrentQuestion]);

  const readQuestion = useCallback(() => {
    if (uiRef.current.isSubmitting) return;

    if (uiRef.current.activeAudio !== 'question') {
      stopAllAudio();
    }

    dispatch({ type: 'QUESTION_AUDIO_TOGGLE_OR_START' });
  }, [stopAllAudio]);

  const readHint = useCallback(() => {
    if (uiRef.current.isSubmitting || !audioEnabledRef.current) return;
    if (!(getAudioAssets(currentItemRef.current).hint?.length)) return;
    if (uiRef.current.activeAudio !== 'hint') stopAllAudio();
    dispatch({ type: 'HINT_AUDIO_TOGGLE_OR_START' });
  }, [stopAllAudio]);

  const hintEnded = useCallback(() => {
    dispatch({ type: 'HINT_AUDIO_ENDED' });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE_AUDIO' });
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'RESUME_AUDIO' });
  }, []);

  const getAnswer = useCallback(() => {
    if (uiRef.current.isSubmitting) return;

    if (uiRef.current.activeAudio === 'answer') {
      dispatch({ type: 'ANSWER_AUDIO_TOGGLED' });
      return;
    }

    stopAllAudio();

    const answerAssetsForCurrentQuestion =
      getAudioAssets(currentItemRef.current).answer ?? [];

    dispatch({
      type: 'ANSWER_REVEALED',
      playAudio: answerAssetsForCurrentQuestion.length > 0,
    });
  }, [stopAllAudio]);

  const toggleAnswerAudio = useCallback(() => {
    dispatch({ type: 'ANSWER_AUDIO_TOGGLED' });
  }, []);

  const questionEnded = useCallback(() => {
    dispatch({ type: 'QUESTION_AUDIO_ENDED' });
  }, []);

  const answerEnded = useCallback(() => {
    dispatch({ type: 'ANSWER_AUDIO_ENDED' });
  }, []);

  const openModal = useCallback((images: string[], startIndex: number) => {
    dispatch({ type: 'OPEN_MODAL', images, startIndex });
  }, []);

  const closeModal = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' });
  }, []);

  const setPanelSnap = useCallback((snap: PanelSnap) => {
    dispatch({ type: 'SET_PANEL_SNAP', snap });
  }, []);

  const setFlag = useCallback((newFlag: any) => {
    const latestItems = itemsRef.current;
    if (latestItems.length > 0 && latestItems[0].question) {
      const updated = latestItems.map((item, idx) => {
        if (idx === 0 && item.question) {
          return {
            ...item,
            question: {
              ...item.question,
              flag: newFlag,
            },
          };
        }
        return item;
      });
      commitItems(updated);
    }
  }, [commitItems]);

  /*
   * The answer the reader typed before revealing the real one. Kept in a ref as
   * well so a verdict submitted from a voice command still carries it.
   */
  const [providedAnswer, setProvidedAnswerState] = useState('');
  const providedAnswerRef = useRef('');

  const setProvidedAnswer = useCallback((text: string) => {
    providedAnswerRef.current = text;
    setProvidedAnswerState(text);
  }, []);

  useEffect(() => {
    dispatch({ type: 'QUESTION_CHANGED' });
    setProvidedAnswer('');
  }, [currentQuestion?.quizq_id, setProvidedAnswer]);

  /*
   * Switching audio on mid-question would otherwise leave the reader with a
   * question that has no soundtrack, because it was queued without one. Fetch
   * the missing assets for what is already on screen instead of discarding it.
   */
  useEffect(() => {
    if (!audioEnabled) return;

    const item = currentItemRef.current;
    const quizqId = item?.question?.quizq_id;
    const assets = getAudioAssets(item);
    const needsHintAudio = Boolean(item?.question?.hint) && !assets.hint?.length;
    if (!quizqId || (assets.question?.length && !needsHintAudio)) return;

    let cancelled = false;

    fetch(`/quiz/audio-assets?quizq_id=${encodeURIComponent(String(quizqId))}`, {
      credentials: 'same-origin',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;

        const latestItems = itemsRef.current;
        if (String(latestItems[0]?.question?.quizq_id) !== String(quizqId)) return;

        commitItems(
          latestItems.map((entry, index) =>
            index === 0 ? {
              ...entry,
              audioAssets: assets.question?.length
                ? { ...entry.audioAssets, hint: data.audioAssets.hint }
                : data.audioAssets,
            } : entry,
          ),
        );
      })
      .catch(() => {
        // Audio is an enhancement: a failure here leaves the quiz readable.
      });

    return () => { cancelled = true; };
  }, [audioEnabled, commitItems, currentQuestion?.quizq_id]);

  useEffect(() => {
    if (!autoPlay) return;
    if (!currentQuestion || questionAssets.length === 0 || ui.isSubmitting) return;

    const timer = window.setTimeout(() => {
      readQuestion();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [currentQuestion?.quizq_id, questionAssets.length, readQuestion, ui.isSubmitting, autoPlay]);

  const actions = useMemo(
    () => ({
      correct: () => submitVerdict('correct'),
      wrong: () => submitVerdict('wrong'),
      slightlyWrong: () => submitVerdict('slightlyWrong'),
      exclude: excludeCurrentQuestion,
      readQuestion,
      readHint,
      hintEnded,
      getAnswer,
      pause,
      resume,
      toggleAnswerAudio,
      questionEnded,
      answerEnded,
      openModal,
      closeModal,
      setPanelSnap,
      setFlag,
      setProvidedAnswer,
      changeCategories,
      setCategoriesOpen,
    }),
    [
      answerEnded,
      closeModal,
      excludeCurrentQuestion,
      getAnswer,
      openModal,
      pause,
      questionEnded,
      readQuestion,
      readHint,
      hintEnded,
      resume,
      setPanelSnap,
      submitVerdict,
      toggleAnswerAudio,
      setFlag,
      setProvidedAnswer,
      changeCategories,
      setCategoriesOpen,
    ],
  );

  const commandHandlers = useMemo<QuizCommandHandlers>(
    () => ({
      correct: actions.correct,
      wrong: actions.wrong,
      slightlyWrong: actions.slightlyWrong,
      getAnswer: actions.getAnswer,
      readQuestion: actions.readQuestion,
      pause: actions.pause,
      resume: actions.resume,
    }),
    [
      actions.correct,
      actions.getAnswer,
      actions.pause,
      actions.readQuestion,
      actions.resume,
      actions.slightlyWrong,
      actions.wrong,
    ],
  );

  return {
    selectedCategories,
    items,
    currentItem,
    currentQuestion,
    questionAssets,
    answerAssets,
    hintAssets,

    isSubmitting: ui.isSubmitting,
    error: ui.error,

    answerRevealed: ui.answerRevealed,

    questionActive: ui.activeAudio === 'question',
    questionPlaying: ui.activeAudio === 'question' && ui.audioPlaying,

    hintActive: ui.activeAudio === 'hint',
    hintPlaying: ui.activeAudio === 'hint' && ui.audioPlaying,

    answerActive: ui.activeAudio === 'answer',
    answerPlaying: ui.activeAudio === 'answer' && ui.audioPlaying,

    modalOpen: ui.modal.open,
    modalImages: ui.modal.images,
    modalStartIndex: ui.modal.startIndex,

    panelSnap: ui.panelSnap,
    queueExhausted: ui.queueExhausted,
    queueExhaustedMessage: ui.queueExhaustedMessage,

    providedAnswer,

    actions,
    commandHandlers,
  };
}
