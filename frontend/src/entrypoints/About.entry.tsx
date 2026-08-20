import React from "react";
import ReactDOM from "react-dom/client";

import { AboutPage } from "../about/AboutPage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("about-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AboutPage />
    </React.StrictMode>
  );
}
