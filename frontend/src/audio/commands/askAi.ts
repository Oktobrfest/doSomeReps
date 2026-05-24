import { AudioCommandManager } from "../AudioCommandManager";

export function registerAskAi(manager: AudioCommandManager) {
  manager.registerCommand("ASK AI", () => console.log("Voice Command: ASK AI"));
}
