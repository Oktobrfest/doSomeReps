import React from "react";
import ReactDOM from "react-dom/client";
import { AudioCommandSystemComponent } from "./AudioCommandSystem";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("audio-command-root");
  if (!container) return;
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <AudioCommandSystemComponent />
    </React.StrictMode>
  );
});
