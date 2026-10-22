import { useEffect, useState } from "react";
import { QuestionEditor } from "./QuestionEditor";
import sharedStyles from "../styles/shared.module.css";

function getReturnTo(): string | null {
  const returnTo = new URLSearchParams(window.location.search).get("return_to");
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return null;
}

export function EditQuestionPage() {
  const [questionId, setQuestionId] = useState<number | null>(null);

  useEffect(() => {
    const qId = new URLSearchParams(window.location.search).get("q_id");
    if (qId) setQuestionId(parseInt(qId, 10));
  }, []);

  const goBack = () => {
    const returnTo = getReturnTo();
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/quiz";
    }
  };

  return (
    <div>
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
          const returnTo = getReturnTo();
          if (returnTo) {
            window.location.href = returnTo;
          } else {
            window.location.href = "/editquestions";
          }
        }}
        onSaved={goBack}
      />
    </div>
  );
}
