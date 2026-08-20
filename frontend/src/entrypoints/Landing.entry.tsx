import React from "react";
import ReactDOM from "react-dom/client";

import { LandingPage } from "../landing/LandingPage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("landing-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LandingPage />
    </React.StrictMode>
  );
}
