import { AudioCommandManager } from "../AudioCommandManager";

export function registerWrong(manager: AudioCommandManager) {
  manager.registerCommand("WRONG", () => {
    console.log("Voice Command: WRONG");

    if (typeof (window as any).audioWrong === "function") {
      (window as any).audioWrong();
      return;
    }

    const wrongBtn = document.querySelector('button[name="incorrect_submit"]') as HTMLButtonElement | null;
    if (wrongBtn) {
      wrongBtn.click();
    } else {
      console.error("Wrong button not found.");
    }
  });
}
