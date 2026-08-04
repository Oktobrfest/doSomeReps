import React from "react";
import ReactDOM from "react-dom/client";

import { EditQuestionPage } from "../question_editor/EditQuestionPage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("edit-question-root");


if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <EditQuestionPage />
    </React.StrictMode>
  );
}