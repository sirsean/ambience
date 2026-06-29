# Ambience

Time and weather-aware visual and audio ambience for the browser. Fullscreen, edge-to-edge WebGL visuals synchronized with layered audio that adapts to your local time of day and weather.

## Time periods

| Period | Hours (local) | Mood |
|--------|---------------|------|
| Night | 9pm – 5am | Dark visuals, calming audio |
| Sunrise | 5am – 9am | Warm visuals, gentle upbeat audio |
| Day | 9am – 9pm | Contemplative visuals, calm audio |

## Stack

- **Frontend:** React + Vite + Three.js (WebGL shaders)
- **Backend:** Hono on Cloudflare Workers
- **Storage:** R2 for audio tracks and manifests
- **Weather:** Open-Meteo (proxied through Worker)

## Development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

Audio uses procedural fallbacks when R2 files are not yet uploaded. Generate real tracks with ElevenLabs:

```bash
ELEVENLABS_API_KEY=your_key npm run generate-tracks
```

Upload generated files to R2:

```bash
wrangler r2 object put ambience-audio/index.json --file=.generated-tracks/index.json
# ... upload track folders from .generated-tracks/tracks/
```

## Deploy

```bash
npm run deploy
```

Requires a Cloudflare account and R2 bucket `ambience-audio` (configured in `wrangler.jsonc`).

## Project structure

- `src/` — React SPA, WebGL renderer, audio engine
- `worker/` — Hono API (`/api/tracks`, `/api/audio`, `/api/weather`)
- `scripts/generate-tracks.ts` — ElevenLabs track generation + R2 upload
- `worker/data/seed-tracks.ts` — Built-in track catalog for dev
