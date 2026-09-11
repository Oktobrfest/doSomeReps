import { AudioCommandManager } from "../AudioCommandManager";

export function registerStopListening(manager: AudioCommandManager) {
  manager.registerCommand("STOP LISTENING", () => {
    console.log(`Executing "STOP LISTENING"`);
    if (typeof (window as any).stopAudioListening === "function") {
      (window as any).stopAudioListening();
    } else {
      console.error("window.stopAudioListening was not found.");
    }
  });
}
