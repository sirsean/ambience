import type { WeatherModifiers } from '../audio/types';

export function weatherCodeToModifiers(code: number, precipitation: number, cloudCover: number): WeatherModifiers {
  const isRain =
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99) ||
    precipitation > 0.5;

  const isOvercast = cloudCover > 70 || code === 3;
  const isClear = code === 0 || code === 1;

  return {
    desaturate: isOvercast ? 0.35 : isRain ? 0.2 : 0,
    particleDensity: isRain ? 1.8 : isClear ? 1.1 : 1.0,
    streakIntensity: isRain ? 1.0 : 0,
    glowSharpness: isClear ? 1.3 : isOvercast ? 0.7 : 1.0,
    humidityBlur: isRain ? 0.4 : cloudCover > 50 ? 0.15 : 0,
  };
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
