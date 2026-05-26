import { AudioCommandManager } from "../AudioCommandManager";

export function registerPause(manager: AudioCommandManager) {
  manager.registerCommand("PAUSE", () => {
    console.log(`Executing "PAUSE"`);
    if (typeof window.audioPause === "function") {
      window.audioPause();
    } else {
      console.error("window.audioPause was not found.");
    }
  });
}
