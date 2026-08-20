import React from "react";
import ReactDOM from "react-dom/client";

import { TopicQuestionsPage } from "../topics/TopicQuestionsPage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("topic-questions-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <TopicQuestionsPage />
    </React.StrictMode>
  );
}
