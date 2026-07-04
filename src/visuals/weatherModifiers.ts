import type { WeatherModifiers } from '../audio/types';

const DEFAULT_MODIFIERS: WeatherModifiers = {
  desaturate: 0,
  particleDensity: 1,
  streakIntensity: 0,
  glowSharpness: 1,
  humidityBlur: 0,
  colorTint: [0, 0, 0],
  brightness: 1,
  warmth: 0,
};

export function weatherCodeToModifiers(code: number, precipitation: number, cloudCover: number): WeatherModifiers {
  const isRain =
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99) ||
    precipitation > 0.5;

  const isOvercast = cloudCover > 70 || code === 3;
  const isClear = code === 0 || code === 1;
  const isPartlyCloudy = code === 2 || (cloudCover > 35 && cloudCover <= 70);
  const isFog = code === 45 || code === 48;

  if (isRain) {
    return {
      desaturate: 0.25,
      particleDensity: 1.8,
      streakIntensity: 1.0,
      glowSharpness: 0.75,
      humidityBlur: 0.4,
      colorTint: [0.02, 0.04, 0.08],
      brightness: 0.72,
      warmth: 0,
    };
  }

  if (isFog) {
    return {
      desaturate: 0.3,
      particleDensity: 1.2,
      streakIntensity: 0,
      glowSharpness: 0.6,
      humidityBlur: 0.55,
      colorTint: [0.06, 0.07, 0.09],
      brightness: 0.85,
      warmth: 0,
    };
  }

  if (isOvercast) {
    return {
      desaturate: 0.4,
      particleDensity: 1.0,
      streakIntensity: 0,
      glowSharpness: 0.65,
      humidityBlur: 0.2,
      colorTint: [0.04, 0.05, 0.07],
      brightness: 0.78,
      warmth: 0,
    };
  }

  if (isClear) {
    return {
      desaturate: 0,
      particleDensity: 1.1,
      streakIntensity: 0,
      glowSharpness: 1.35,
      humidityBlur: 0,
      colorTint: [0.04, 0.08, 0.14],
      brightness: 1.18,
      warmth: 0.35,
    };
  }

  if (isPartlyCloudy) {
    return {
      desaturate: 0.1,
      particleDensity: 1.05,
      streakIntensity: 0,
      glowSharpness: 1.05,
      humidityBlur: 0.08,
      colorTint: [0.02, 0.04, 0.06],
      brightness: 1.0,
      warmth: 0.12,
    };
  }

  return { ...DEFAULT_MODIFIERS };
}

export function weatherCodeLabel(code: number): string {
  const labels: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Drizzle',
    61: 'Rain',
    71: 'Snow',
    80: 'Showers',
    95: 'Thunderstorm',
  };

  if (labels[code]) return labels[code];
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Storm';
  return 'Unknown';
}
