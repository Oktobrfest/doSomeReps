import React from "react";
import { createRoot } from "react-dom/client";

import "../styles/global.css";

/**
 * Mount a page component onto the root div its Jinja template renders.
 *
 * Every page entry is this same four lines; the id and the component are all
 * that differ. A missing root is not an error: templates share entries.
 */
export function mountPage(rootElementId: string, page: React.ReactElement) {
  const rootElement = document.getElementById(rootElementId);
  if (!rootElement) return;

  createRoot(rootElement).render(<React.StrictMode>{page}</React.StrictMode>);
}
