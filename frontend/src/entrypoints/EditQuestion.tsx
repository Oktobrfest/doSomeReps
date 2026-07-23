import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { QuestionEditor } from "../question_editor/QuestionEditor";
import "../index.css";

function EditQuestionReact() {
  const [questionId, setQuestionId] = useState<number | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qIdStr = urlParams.get("q_id");
    if (qIdStr) {
      const qId = parseInt(qIdStr, 10);
      setQuestionId(qId);
    }
  }, []);

  const handleDeleted = () => {
    window.location.href = "/editquestions";
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/quiz";
    }
  };

  const handleSaved = () => {
    window.location.reload();
  };

  return (
    <div>
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleBack}
        >
          <i className="fa fa-arrow-left mr-2"></i> Go Back
        </button>
      </div>
      <QuestionEditor
        questionId={questionId}
        onDeleted={handleDeleted}
        onSaved={handleSaved}
      />
    </div>
  );
}

const rootElement = document.getElementById("react-edit-question-root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <EditQuestionReact />
    </React.StrictMode>
  );
}
