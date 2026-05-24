import { AudioCommandManager } from "../AudioCommandManager";

export function registerGetAnswer(manager: AudioCommandManager) {
  manager.registerCommand("GET ANSWER", () => console.log("Voice Command: GET ANSWER"));
}
