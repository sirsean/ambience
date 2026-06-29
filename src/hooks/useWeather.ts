import { useEffect, useState } from 'react';
import type { WeatherData } from '../audio/types';
import { fetchWeather } from '../lib/api';
import { weatherCodeToModifiers } from '../visuals/weatherModifiers';

const POLL_INTERVAL_MS = 10 * 60 * 1000;

const DEFAULT_WEATHER: WeatherData = {
  temperature: 68,
  unit: 'fahrenheit',
  weatherCode: 1,
  cloudCover: 30,
  precipitation: 0,
  isDay: true,
};

export function useWeather(lat: number | null, lon: number | null) {
  const [weather, setWeather] = useState<WeatherData>(DEFAULT_WEATHER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat === null || lon === null) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWeather(lat, lon);
        if (!cancelled) setWeather(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Weather unavailable');
          setWeather(DEFAULT_WEATHER);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lat, lon]);

  const modifiers = weatherCodeToModifiers(weather.weatherCode, weather.precipitation, weather.cloudCover);

  return { weather, modifiers, loading, error };
}
