import type { WeatherData } from '../audio/types';
import { weatherCodeLabel } from '../visuals/weatherModifiers';

interface WeatherBadgeProps {
  weather: WeatherData;
  timezone: string;
  loading: boolean;
  geoError: string | null;
  onRetryGeo: () => void;
}

export function WeatherBadge({ weather, timezone, loading, geoError, onRetryGeo }: WeatherBadgeProps) {
  return (
    <div className="weather-badge">
      <span>{loading ? '…' : weatherCodeLabel(weather.weatherCode)}</span>
      <span className="weather-badge__sep">·</span>
      <span>{Math.round(weather.temperature)}°F</span>
      <span className="weather-badge__sep">·</span>
      <span className="weather-badge__tz">{timezone}</span>
      {geoError && (
        <>
          <span className="weather-badge__sep">·</span>
          <button type="button" className="link" onClick={onRetryGeo}>
            Enable location
          </button>
        </>
      )}
    </div>
  );
}
