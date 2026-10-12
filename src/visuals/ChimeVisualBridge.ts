import type { ChimeEvent, Milieu, WeatherModifiers } from '../audio/types';
import { GLASS_PANE_COUNT } from './GlassGrid';

export interface VisualState {
  audioLevel: number;
  milieuBlend: { from: Milieu; to: Milieu; t: number };
  weather: WeatherModifiers;
}

export interface ChimeVisualState {
  pane: number;
  amount: number;
  sweep: number;
  color: [number, number, number];
}

export const CHIME_DURATION_MS = 3600;

const SHIMMER_COLORS = [
  [0.3, 0.95, 0.9],
  [0.85, 0.4, 0.95],
  [1.0, 0.75, 0.3],
] as const;

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export class ChimeVisualBridge {
  private readonly state: ChimeVisualState = { pane: -1, amount: 0, sweep: 0, color: [0, 0, 0] };
  private startedAt = 0;
  private intensity = 0;
  private colorOffset = 0;
  private lastPane = -1;

  trigger(event: ChimeEvent, now = performance.now()): void {
    // Avoid consecutive repeats without a retry loop, including after a pulse expires.
    const random = Math.random();
    this.lastPane = this.lastPane < 0
      ? Math.floor(random * GLASS_PANE_COUNT)
      : (this.lastPane + 1 + Math.floor(random * (GLASS_PANE_COUNT - 1))) % GLASS_PANE_COUNT;
    this.state.pane = this.lastPane;
    this.state.amount = 0;
    this.startedAt = now;
    this.intensity = 0.4 + Math.max(0, Math.min(1, event.intensity)) * 0.6;
    this.colorOffset = event.visualEvent === 'flare' ? 2 : event.visualEvent === 'pulse' ? 1 : 0;
  }

  update(now = performance.now()): ChimeVisualState {
    if (this.state.pane < 0) return this.state;

    const age = Math.max(0, now - this.startedAt);
    if (age >= CHIME_DURATION_MS) {
      this.state.pane = -1;
      this.state.amount = 0;
      return this.state;
    }

    const seconds = age / 1000;
    const envelope = smoothstep(age / 220) * smoothstep((CHIME_DURATION_MS - age) / 1200);
    this.state.amount = envelope * this.intensity * (0.82 + 0.18 * Math.sin(seconds * 3));
    this.state.sweep = (seconds / 1.8) % 1.4 - 0.2;

    const colorPhase = this.colorOffset + seconds * 0.85;
    const index = Math.floor(colorPhase);
    const blend = smoothstep(colorPhase - index);
    const from = SHIMMER_COLORS[index % SHIMMER_COLORS.length];
    const to = SHIMMER_COLORS[(index + 1) % SHIMMER_COLORS.length];
    for (let channel = 0; channel < 3; channel++) {
      this.state.color[channel] = from[channel] + (to[channel] - from[channel]) * blend;
    }
    return this.state;
  }
}

export function createDefaultVisualState(): VisualState {
  return {
    audioLevel: 0,
    milieuBlend: { from: 'day', to: 'day', t: 1 },
    weather: {
      desaturate: 0,
      particleDensity: 1,
      streakIntensity: 0,
      glowSharpness: 1,
      humidityBlur: 0,
      colorTint: [0, 0, 0],
      brightness: 1,
      warmth: 0,
    },
  };
}
