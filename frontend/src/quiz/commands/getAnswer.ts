import { AudioCommandManager } from "../AudioCommandManager";

export function registerGetAnswer(manager: AudioCommandManager) {
  manager.registerCommand("GET ANSWER", () => {
    console.log("Voice Command: GET ANSWER");

    if (typeof (window as any).audioGetAnswer === "function") {
      (window as any).audioGetAnswer();
      return;
    }

    console.error("window.audioGetAnswer was not found.");
  });
}
