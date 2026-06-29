import type { Milieu, TrackManifest, TrackSummary, WeatherData } from '../audio/types';

export async function fetchTracks(milieu?: Milieu): Promise<TrackSummary[]> {
  const params = milieu ? `?milieu=${milieu}` : '';
  const response = await fetch(`/api/tracks${params}`);
  if (!response.ok) throw new Error('Failed to fetch tracks');
  return response.json() as Promise<TrackSummary[]>;
}

export async function fetchTrackManifest(id: string): Promise<{ manifest: TrackManifest; prefix: string }> {
  const response = await fetch(`/api/tracks/${encodeURIComponent(id)}/manifest`);
  if (!response.ok) throw new Error(`Failed to fetch manifest for ${id}`);
  return response.json() as Promise<{ manifest: TrackManifest; prefix: string }>;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
  if (!response.ok) throw new Error('Failed to fetch weather');
  return response.json() as Promise<WeatherData>;
}

export async function healthCheck(): Promise<boolean> {
  const response = await fetch('/api/health');
  return response.ok;
}
