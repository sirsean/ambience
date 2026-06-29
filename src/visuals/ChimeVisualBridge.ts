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

    if (event.milieu === 'night') {
      this.burst = Math.min(0.28, event.intensity * 0.18 + 0.06);
      this.burstDecay = 0.988;
      this.chimeStyle = 0;
      return;
    }

    if (event.milieu === 'sunrise') {
      this.burst = Math.min(0.65, event.intensity * 0.5 + 0.2);
      this.burstDecay = 0.972;
    } else {
      this.burst = Math.min(0.55, event.intensity * 0.4 + 0.15);
      this.burstDecay = 0.965;
    }

    this.chimeStyle =
      event.visualEvent === 'flare' ? 1 : event.visualEvent === 'pulse' ? 2 : 0;
  }

  update(): ChimeVisualState {
    if (this.burst > 0) {
      this.ripplePhase += 0.04 + this.burst * 0.06;
    }

    this.burst *= this.burstDecay;
    if (this.burst < 0.001) {
      this.burst = 0;
      this.chimeStyle = 0;
    }

    return {
      burst: this.burst,
      style: this.chimeStyle * this.burst,
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
    },
    time: 0,
  };
}
