export type Milieu = 'night' | 'sunrise' | 'day';

export type VisualEvent = 'ripple' | 'flare' | 'pulse';

export interface ChimeDefinition {
  id: string;
  file: string;
  visualEvent: VisualEvent;
  intensity: number;
}

export interface TrackPlayback {
  loop: boolean;
  restartCrossfadeSec?: number;
}

export interface TrackSchedule {
  minIntervalSec: number;
  maxIntervalSec: number;
}

export interface TrackManifest {
  id: string;
  name: string;
  milieu: Milieu;
  baseLoop: string;
  playback?: TrackPlayback;
  chimePool: ChimeDefinition[];
  schedule: TrackSchedule;
}

export interface TrackSummary {
  id: string;
  name: string;
  milieu: Milieu;
}

export interface ChimeEvent {
  chimeId: string;
  visualEvent: VisualEvent;
  intensity: number;
  milieu: Milieu;
}

export interface WeatherData {
  temperature: number;
  unit: 'fahrenheit';
  weatherCode: number;
  cloudCover: number;
  precipitation: number;
  isDay: boolean;
}

export interface WeatherModifiers {
  desaturate: number;
  particleDensity: number;
  streakIntensity: number;
  glowSharpness: number;
  humidityBlur: number;
  /** RGB offset blended into day palette based on conditions */
  colorTint: readonly [number, number, number];
  /** Brightness multiplier for day coloring */
  brightness: number;
  /** 0 = cool blue, 1 = warmer sky (clear/sunny) */
  warmth: number;
}
