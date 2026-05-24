import { AudioCommandManager } from "../AudioCommandManager";

export function registerCorrect(manager: AudioCommandManager) {
  manager.registerCommand("CORRECT", () => console.log("Voice Command: CORRECT"));
}
