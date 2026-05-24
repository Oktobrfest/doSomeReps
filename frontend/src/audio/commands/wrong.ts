import { AudioCommandManager } from "../AudioCommandManager";

export function registerWrong(manager: AudioCommandManager) {
  manager.registerCommand("WRONG", () => console.log("Voice Command: WRONG"));
}
