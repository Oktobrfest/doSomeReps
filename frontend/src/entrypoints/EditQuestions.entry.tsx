import React from "react";
import ReactDOM from "react-dom/client";

import { EditQuestionsPage } from "../question_search/EditQuestionsPage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("edit-questions-root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <EditQuestionsPage />
    </React.StrictMode>
  );
}