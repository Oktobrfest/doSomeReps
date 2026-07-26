import ReactDOM from "react-dom/client";
import React from "react";

import "../index.css";

import { EditQuestionReact } from "@/question_editor/EditQuestionPage";


const rootElement = document.getElementById("react-edit-question-root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <EditQuestionReact />
    </React.StrictMode>
  );
}
