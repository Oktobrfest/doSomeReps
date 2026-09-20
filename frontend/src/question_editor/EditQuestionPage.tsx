import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { QuestionEditor } from "./QuestionEditor";
import sharedStyles from "../styles/shared.module.css";

export function EditQuestionPage() {
  const [questionId, setQuestionId] = useState<number | null>(null);

  useEffect(() => {
    const qId = new URLSearchParams(window.location.search).get("q_id");
    if (qId) setQuestionId(parseInt(qId, 10));
  }, []);

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/quiz";
    }
  };

  return (
    <div>
      <Toaster richColors position="top-right" />

      <button
        type="button"
        className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
        onClick={goBack}
      >
        <i className={`fa fa-arrow-left ${sharedStyles.iconSpacing}`}></i> Go Back
      </button>

      <QuestionEditor
        questionId={questionId}
        onDeleted={() => {
          window.location.href = "/editquestions";
        }}
        onSaved={goBack}
      />
    </div>
  );
}
