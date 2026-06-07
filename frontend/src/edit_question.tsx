import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { QuestionEditor } from "./components/QuestionEditor";
import "./index.css";

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

  return (
    <QuestionEditor
      questionId={questionId}
      onDeleted={handleDeleted}
    />
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