import { CommandCallback } from "./types";

export class AudioCommandManager {
  private callbacks = new Map<string, CommandCallback>();

  registerCommand(command: string, callback: CommandCallback) {
    this.callbacks.set(this.normalize(command), callback);
  }

  triggerCommand(command: string) {
    const normalized = this.normalize(command);
    const callback = this.callbacks.get(normalized);
    if (!callback) {
      console.warn(`[AudioCommandManager] No callback registered for "${normalized}"`);
      return;
    }
    console.log(`[AudioCommandManager] Triggered "${normalized}"`);
    callback();
  }

  private normalize(command: string) {
    return command.toUpperCase().trim();
  }
}
