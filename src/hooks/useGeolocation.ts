import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ambience-geolocation';

export interface GeolocationState {
  lat: number | null;
  lon: number | null;
  loading: boolean;
  error: string | null;
  request: () => void;
}

function loadStored(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lon: number };
    if (typeof parsed.lat === 'number' && typeof parsed.lon === 'number') return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function useGeolocation(): GeolocationState {
  const stored = loadStored();
  const [lat, setLat] = useState<number | null>(stored?.lat ?? null);
  const [lon, setLon] = useState<number | null>(stored?.lon ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude;
        const nextLon = position.coords.longitude;
        setLat(nextLat);
        setLon(nextLon);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: nextLat, lon: nextLon }));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600_000 },
    );
  }, []);

  useEffect(() => {
    if (!stored) request();
  }, [request, stored]);

  return { lat, lon, loading, error, request };
}
