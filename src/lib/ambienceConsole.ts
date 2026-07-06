import type { VisualEvent } from '../audio/types';

export interface AmbienceConsole {
  triggerChime(overrides?: { visualEvent?: VisualEvent; intensity?: number }): void;
}

declare global {
  interface Window {
    __ambience?: AmbienceConsole;
  }
}

export function exposeAmbienceConsole(api: AmbienceConsole): void {
  window.__ambience = api;
}
