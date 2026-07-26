import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import { toast } from "sonner";
import type { ExtendPayload } from "../components/ExtendButton";
import {
  deleteAudio,
  deleteQuestion,
  extendQuestion,
  getQuestion,
  saveQuestion,
} from "./question_editor_api";
import type {
  AudioData,
  PicsByType,
  QuestionData,
  QuestionEditorProps,
  QuestionFilesByType,
  QuestionPart,
  QuestionUpdatePayload,
} from "./question_editor_types";

interface UseQuestionEditorOptions {
  questionId: QuestionEditorProps["questionId"];
  onDeleted: QuestionEditorProps["onDeleted"];
  onSaved: QuestionEditorProps["onSaved"];
}

const createEmptyPics = (): PicsByType => ({
  hint: [],
  answer: [],
  question: [],
});

const createEmptyFiles = (): QuestionFilesByType => ({
  hint: [],
  answer: [],
  question: [],
});

export function useQuestionEditor({
  questionId,
  onDeleted,
  onSaved,
}: UseQuestionEditorOptions) {
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState<string>("");
  const [hintText, setHintText] = useState<string>("");
  const [answerText, setAnswerText] = useState<string>("");
  const [privacy, setPrivacy] = useState<boolean>(false);
  const [pics, setPics] = useState<PicsByType>(createEmptyPics);
  const [audioFiles, setAudioFiles] = useState<AudioData[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const [filesByType, setFilesByType] =
    useState<QuestionFilesByType>(createEmptyFiles);

  const [deleting, setDeleting] = useState(false);
  const [extending, setExtending] = useState(false);

  const clearLoadedQuestion = useCallback(() => {
    setQuestionText("");
    setHintText("");
    setAnswerText("");
    setPrivacy(false);
    setPics(createEmptyPics());
    setAudioFiles([]);
  }, []);

  const clearEditor = useCallback(() => {
    clearLoadedQuestion();
    setSelectedCats([]);
    setFilesByType(createEmptyFiles());
  }, [clearLoadedQuestion]);

  const applyQuestionData = useCallback((qData: QuestionData) => {
    setQuestionText(qData.question_text || "");
    setHintText(qData.hint || "");
    setAnswerText(qData.answer || "");
    setPrivacy(!!qData.privacy);
    setPics(qData.pics_by_type || createEmptyPics());
    setAudioFiles(qData.audio_files || []);
    setSelectedCats(qData.categories || []);
  }, []);

  useEffect(() => {
    if (!questionId) {
      clearEditor();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getQuestion(questionId)
      .then((qData) => {
        applyQuestionData(qData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "An error occurred.");
        setLoading(false);
      });
  }, [applyQuestionData, clearEditor, questionId]);

  const validateFiles = (files: File[]): boolean => {
    const invalidCharRegex = /[^a-zA-Z0-9_. !@#$%^&()\-]/;
    const invalidFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const filename = files[i].name;
      const startsWithDot = filename.startsWith(".");
      const hasExtension = filename.includes(".");

      if (startsWithDot && !hasExtension) {
        invalidFiles.push(filename);
      } else if (invalidCharRegex.test(filename)) {
        invalidFiles.push(filename);
      }
    }

    if (invalidFiles.length > 0) {
      toast.error(
        "The following filenames are invalid: " + invalidFiles.join(", ")
      );
      return false;
    }
    return true;
  };

  const handleFileChange = (
    part: QuestionPart,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    const filesArray = Array.from(event.target.files);
    if (validateFiles(filesArray)) {
      setFilesByType((previous) => ({
        ...previous,
        [part]: filesArray,
      }));
    } else {
      event.target.value = "";
      setFilesByType((previous) => ({
        ...previous,
        [part]: [],
      }));
    }
  };

  const removeExistingPic = (part: QuestionPart, id: number) => {
    setPics((previous) => ({
      ...previous,
      [part]: previous[part].filter((pic) => pic.pic_id !== id),
    }));
  };

  const handleAudioDelete = async (audioId: number) => {
    try {
      await deleteAudio(audioId);
      setAudioFiles((previous) =>
        previous.filter((audio) => audio.audio_id !== audioId)
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete audio."
      );
    }
  };

  const removeNewFile = (part: QuestionPart, index: number) => {
    setFilesByType((previous) => ({
      ...previous,
      [part]: previous[part].filter((_, fileIndex) => fileIndex !== index),
    }));
  };

  const handleDelete = async () => {
    if (!questionId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this question?"
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteQuestion(questionId);

      setSuccessMsg("Question deleted successfully!");
      clearLoadedQuestion();

      if (onDeleted) {
        setTimeout(() => {
          onDeleted();
        }, 1000);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete question."
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleExtend = async ({
    customInstructions,
    selectedOptions,
  }: ExtendPayload) => {
    if (!questionId) return;

    setExtending(true);
    setError(null);

    try {
      const data = await extendQuestion({
        questionId,
        questionText,
        hintText,
        answerText,
        categories: selectedCats,
        customInstructions,
        selectedOptions,
      });

      setAnswerText(data.question?.answer ?? answerText);
      setHintText(data.question?.hint ?? hintText);
      toast.success("Answer extended with AI.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extend failed";
      setError(message);
      toast.error(message);
    } finally {
      setExtending(false);
    }
  };

  const handleSave = async () => {
    if (!questionId) return;

    if (selectedCats.length === 0) {
      toast.error("Please select at least one category before saving.");
      return;
    }

    if (questionText.length > 1500) {
      toast.error(
        `Question text cannot exceed 1500 characters (currently ${questionText.length} characters).`
      );
      return;
    }

    if (hintText && hintText.length > 2000) {
      toast.error(
        `Hint cannot exceed 2000 characters (currently ${hintText.length} characters).`
      );
      return;
    }

    if (answerText.length > 4000) {
      toast.error(
        `Answer cannot exceed 4000 characters (currently ${answerText.length} characters).`
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload: QuestionUpdatePayload = {
      id: questionId,
      question_text: questionText,
      hint: hintText,
      answer: answerText,
      privacy,
      categories: selectedCats,
      pics_by_type: {
        hint: pics.hint.map((pic) => pic.pic_string),
        answer: pics.answer.map((pic) => pic.pic_string),
        question: pics.question.map((pic) => pic.pic_string),
      },
    };

    try {
      await saveQuestion({
        payload,
        questionFiles: filesByType.question,
        hintFiles: filesByType.hint,
        answerFiles: filesByType.answer,
      });

      toast.success("Question saved successfully!");
      setFilesByType(createEmptyFiles());

      getQuestion(questionId)
        .then((qData) => {
          setPics(qData.pics_by_type || createEmptyPics());
          setAudioFiles(qData.audio_files || []);
        })
        .catch(console.error);

      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    deleting,
    extending,
    error,
    successMsg,
    questionText,
    hintText,
    answerText,
    privacy,
    pics,
    audioFiles,
    selectedCats,
    filesByType,
    setQuestionText,
    setHintText,
    setAnswerText,
    setPrivacy,
    setSelectedCats,
    dismissError: () => setError(null),
    dismissSuccess: () => setSuccessMsg(null),
    handleFileChange,
    removeExistingPic,
    removeNewFile,
    handleAudioDelete,
    handleDelete,
    handleExtend,
    handleSave,
  };
}
