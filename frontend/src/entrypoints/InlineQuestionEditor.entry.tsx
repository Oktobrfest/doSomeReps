import ReactDOM from "react-dom/client";
import React from "react";

import { InlineQuestionEditor } from "../question_editor/InlineQuestionEditor";
import "../index.css";

// Create and mount the React app
const rootElement = document.getElementById("react-edit-question-root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <InlineQuestionEditor />
    </React.StrictMode>
  );
}

// Expose function for vanilla JS to set the question ID
declare global {
  interface Window {
    setEditQuestionId: (id: number | null) => void;
  }
}

// Initialize the global function when the module loads
window.setEditQuestionId = function(id: number | null) {
  // Dispatch a custom event that our React component can listen to
  window.dispatchEvent(new CustomEvent('setEditQuestionId', { detail: { id } }));
};
