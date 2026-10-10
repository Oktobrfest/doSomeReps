import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../lib/errors";
import { notify } from "../toast/notify";
import {
  deleteAudio,
  deleteQuestion,
  loadQuestion,
  updateQuestion,
} from "../question/question_api";
import {
  draftError,
  emptyDraft,
  type AudioAsset,
  type QuestionDraft,
} from "../question/question_types";
import type { QuestionEditorProps } from "./question_editor_types";

type UseQuestionEditorOptions = Pick<
  QuestionEditorProps,
  "questionId" | "onDeleted" | "onSaved"
>;

/** Loading, saving and deleting the one question the editor is pointed at. */
export function useQuestionEditor({
  questionId,
  onDeleted,
  onSaved,
}: UseQuestionEditorOptions) {
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [audio, setAudio] = useState<AudioAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const report = (err: unknown, fallback: string) =>
    notify.error(errorMessage(err, fallback));

  const load = useCallback(async (id: number) => {
    const loaded = await loadQuestion(id);
    setDraft(loaded.draft);
    setAudio(loaded.audio);
  }, []);

  useEffect(() => {
    if (!questionId) {
      setDraft(emptyDraft());
      setAudio([]);
      return;
    }

    setLoading(true);
    load(questionId)
      .catch((err) => report(err, "Failed to load question details."))
      .finally(() => setLoading(false));
  }, [load, questionId]);

  const handleAudioDelete = async (audioId: number) => {
    try {
      await deleteAudio(audioId);
      setAudio((previous) => previous.filter((a) => a.audio_id !== audioId));
    } catch (err) {
      report(err, "Failed to delete audio.");
    }
  };

  const handleDelete = async () => {
    if (!questionId) return;
    if (!window.confirm("Are you sure you want to delete this question?")) return;

    setDeleting(true);
    try {
      await deleteQuestion(questionId);
      setDraft(emptyDraft());
      setAudio([]);
      notify.success("Question deleted.");
      onDeleted?.();
    } catch (err) {
      report(err, "Failed to delete question.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!questionId) return;

    const problem = draftError(draft);
    if (problem) {
      notify.error(problem);
      return;
    }

    setSaving(true);
    try {
      await updateQuestion(questionId, draft);
      // Reload so the images just uploaded come back with their stored ids.
      await load(questionId);
      notify.success("Question saved.");
      onSaved?.();
    } catch (err) {
      report(err, "Failed to save the question.");
    } finally {
      setSaving(false);
    }
  };

  return {
    draft,
    setDraft,
    audio,
    loading,
    saving,
    deleting,
    handleAudioDelete,
    handleDelete,
    handleSave,
  };
}
