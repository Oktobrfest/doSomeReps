import React from "react";
import ReactDOM from "react-dom/client";

import { EditQuestionPage } from "../question_editor/EditQuestionPage";
import "../index.css";

const rootElement = document.getElementById("react-edit-question-root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <EditQuestionPage />
    </React.StrictMode>
  );
}