import React from "react";
import ReactDOM from "react-dom/client";

import { ProfilePage } from "../profile/ProfilePage";
import "../index.css";
import "../styles/global.css";

const rootElement = document.getElementById("profile-root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ProfilePage />
    </React.StrictMode>
  );
}
