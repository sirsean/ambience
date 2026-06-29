import { Hono } from 'hono';

export const weatherRoutes = new Hono();

const CACHE_TTL_SEC = 600;
const CACHE_VERSION = 'fahrenheit-v1';

function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

weatherRoutes.get('/', async (c) => {
  const lat = c.req.query('lat');
  const lon = c.req.query('lon');

  if (!lat || !lon) {
    return c.json({ error: 'lat and lon are required' }, 400);
  }

  const cacheKey = new Request(`${c.req.url}&${CACHE_VERSION}`, c.req.raw);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('current', 'temperature_2m,weather_code,cloud_cover,precipitation,is_day');
  url.searchParams.set('timezone', 'auto');

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    return c.json({ error: 'Weather service unavailable' }, 502);
  }

  const data = (await upstream.json()) as {
    current: {
      temperature_2m: number;
      weather_code: number;
      cloud_cover: number;
      precipitation: number;
      is_day: number;
    };
  };

  const body = {
    temperature: celsiusToFahrenheit(data.current.temperature_2m),
    unit: 'fahrenheit' as const,
    weatherCode: data.current.weather_code,
    cloudCover: data.current.cloud_cover,
    precipitation: data.current.precipitation,
    isDay: data.current.is_day === 1,
  };

  const response = c.json(body);
  response.headers.set('Cache-Control', `public, s-maxage=${CACHE_TTL_SEC}`);
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
});
