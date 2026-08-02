import React from "react";
import ReactDOM from "react-dom/client";
import { AiQuestionGenerator } from "../ai_question_generator/AiQuestionGenerator";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("ai-question-generator-root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AiQuestionGenerator />
    </React.StrictMode>
  );
}
