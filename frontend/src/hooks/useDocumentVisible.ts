import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Whether the reader can see the page right now, i.e. its tab is in front. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, () => !document.hidden);
}
