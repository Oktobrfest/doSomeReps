import { AudioCommandManager } from "../AudioCommandManager";
import { registerReload } from "./reload";
import { registerAskAi } from "./askAi";
import { registerStopListening } from "./stopListening";

export function registerAllCommands(manager: AudioCommandManager) {
  registerReload(manager);
  registerAskAi(manager);
  registerStopListening(manager);
}
