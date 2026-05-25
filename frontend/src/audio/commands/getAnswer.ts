import { AudioCommandManager } from "../AudioCommandManager";

export function registerGetAnswer(manager: AudioCommandManager) {
  manager.registerCommand("GET ANSWER", () => {
    console.log("Voice Command: GET ANSWER");
    const getAnswerBtn = document.getElementById("audio-get-answer-btn") as HTMLButtonElement | null;
    if (getAnswerBtn) {
      getAnswerBtn.click();
    } else {
      console.error("Get Answer button not found.");
    }
  });
}
