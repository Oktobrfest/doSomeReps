import { AudioCommandManager } from "../AudioCommandManager";

export function registerAskAi(manager: AudioCommandManager) {
  manager.registerCommand("ASK AI", () => {
    console.log(`Executing "ASK AI"`);
    if (typeof (window as any).audioAskAi === "function") {
      (window as any).audioAskAi();
    } else {
      console.error("window.audioAskAi was not found.");
    }
  });
}
