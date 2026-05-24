import { AudioCommandManager } from "../AudioCommandManager";

export function registerReadQuestion(manager: AudioCommandManager) {
  manager.registerCommand("READ QUESTION", () => {
    console.log(`Executing "READ QUESTION"`);
    if (typeof window.audioReadQuestion === "function") {
      window.audioReadQuestion();
    } else {
      console.error("window.audioReadQuestion was not found.");
    }
  });
}
