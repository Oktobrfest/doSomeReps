import React from "react";
import ReactDOM from "react-dom/client";

import { TopicListPage } from "../topics/TopicListPage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("topic-list-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <TopicListPage />
    </React.StrictMode>
  );
}
