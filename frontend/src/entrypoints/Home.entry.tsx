import React from "react";
import ReactDOM from "react-dom/client";

import { HomePage } from "../home/HomePage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("home-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <HomePage />
    </React.StrictMode>
  );
}
