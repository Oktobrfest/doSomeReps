import React from "react";
import ReactDOM from "react-dom/client";

import { QueMorePage } from "../quemore/QueMorePage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("quemore-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueMorePage />
    </React.StrictMode>
  );
}
