export interface QuestionEditorProps {
  questionId: number | null;
  onDeleted?: () => void;
  onSaved?: () => void;
  onClose?: () => void;
}
