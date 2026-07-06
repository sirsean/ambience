import type { ChimeEvent, Milieu, WeatherModifiers } from '../audio/types';

export interface VisualState {
  audioLevel: number;
  chimeBurst: number;
  milieuBlend: { from: Milieu; to: Milieu; t: number };
  weather: WeatherModifiers;
  time: number;
}

export interface ChimeVisualState {
  burst: number;
  style: number;
  center: { x: number; y: number };
  ripplePhase: number;
}

export class ChimeVisualBridge {
  private burst = 0;
  private burstDecay = 0.965;
  private chimeStyle = 0;
  private center = { x: 0.5, y: 0.5 };
  private ripplePhase = 0;

  trigger(event: ChimeEvent): void {
    this.center = {
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
    };
    this.ripplePhase = 0;

    this.burst = Math.min(1.0, event.intensity * 0.55 + 0.4);
    this.burstDecay = event.milieu === 'night' ? 0.984 : 0.978;

    this.chimeStyle =
      event.visualEvent === 'flare' ? 1 : event.visualEvent === 'pulse' ? 2 : 0;
  }

  update(): ChimeVisualState {
    if (this.burst > 0) {
      const speed = this.chimeStyle === 1 ? 0.14 : this.chimeStyle === 2 ? 0.24 : 0.2;
      this.ripplePhase += speed + this.burst * 0.1;
    }

    this.burst *= this.burstDecay;
    if (this.burst < 0.001) {
      this.burst = 0;
      this.chimeStyle = 0;
    }

    return {
      burst: this.burst,
      style: this.chimeStyle,
      center: this.center,
      ripplePhase: this.ripplePhase,
    };
  }
}

export type VisualStateListener = (state: VisualState) => void;

export function createDefaultVisualState(): VisualState {
  return {
    audioLevel: 0,
    chimeBurst: 0,
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
    time: 0,
  };
}
