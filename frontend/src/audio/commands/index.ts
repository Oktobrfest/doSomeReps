import { AudioCommandManager } from "../AudioCommandManager";
import { registerReadQuestion } from "./readQuestion";
import { registerCorrect } from "./correct";
import { registerWrong } from "./wrong";
import { registerGetAnswer } from "./getAnswer";
import { registerReload } from "./reload";
import { registerAskAi } from "./askAi";
import { registerPause } from "./pause";
import { registerResume } from "./resume";
import { registerStopListening } from "./stopListening";

export function registerAllCommands(manager: AudioCommandManager) {
  registerReadQuestion(manager);
  registerCorrect(manager);
  registerWrong(manager);
  registerGetAnswer(manager);
  registerReload(manager);
  registerAskAi(manager);
  registerPause(manager);
  registerResume(manager);
  registerStopListening(manager);
}
