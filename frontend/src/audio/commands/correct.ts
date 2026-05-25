import { AudioCommandManager } from "../AudioCommandManager";

export function registerCorrect(manager: AudioCommandManager) {
  manager.registerCommand("CORRECT", () => {
    console.log("Voice Command: CORRECT");
    const correctBtn = document.querySelector('button[name="correct_submit"]') as HTMLButtonElement | null;
    if (correctBtn) {
      correctBtn.click();
    } else {
      console.error("Correct button not found.");
    }
  });
}
