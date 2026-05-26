import { AudioCommandManager } from "../AudioCommandManager";

export function registerResume(manager: AudioCommandManager) {
  manager.registerCommand("RESUME", () => {
    console.log(`Executing "RESUME"`);
    if (typeof window.audioResume === "function") {
      window.audioResume();
    } else {
      console.error("window.audioResume was not found.");
    }
  });
}
