import { AudioCommandManager } from "../AudioCommandManager";

export function registerCorrect(manager: AudioCommandManager) {
  manager.registerCommand("CORRECT", () => {
    console.log("Voice Command: CORRECT");

    if (typeof (window as any).audioCorrect === "function") {
      (window as any).audioCorrect();
      return;
    }

    const correctBtn = document.querySelector('button[name="correct_submit"]') as HTMLButtonElement | null;
    if (correctBtn) {
      correctBtn.click();
    } else {
      console.error("Correct button not found.");
    }
  });
}
