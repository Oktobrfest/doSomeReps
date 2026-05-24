import { AudioCommandManager } from "../AudioCommandManager";

export function registerReload(manager: AudioCommandManager) {
  manager.registerCommand("RELOAD", () => console.log("Voice Command: RELOAD"));
}
