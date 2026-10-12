# Ambience

Time and weather-aware visual and audio ambience for the browser. A fullscreen WebGL stained-glass grid accompanies layered audio that adapts to your local time of day and weather. Its 48 colored panes continuously exchange space, and each chime makes one pane shimmer for 3.6 seconds.

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

## Rendering and checks

The renderer targets 30 frames per second with one instanced draw call. It caps pixel density at 1 and the drawing buffer at 1.25 million pixels, so a high-resolution screen does not multiply the GPU workload. Pane borders use lightweight shader smoothing instead of multisample antialiasing. Geometry and color buffers are reused; hidden tabs and zero-size containers suspend visual rendering while audio continues. Graphics contexts are restored automatically after a context loss.

Day, sunrise, and night use distinct glass palettes. Weather changes brightness, saturation, and tint without adding particles or blur passes. Motion and chime durations follow elapsed time, including after dropped frames or a hidden-tab interval.

```bash
npm run test:visuals  # Grid coverage, motion, pulse timing, and pixel-budget tests
npm test -- --run     # Production build, visual tests, and Worker tests
```

After entering the app, browser-console calls such as `window.__ambience.triggerChime({ visualEvent: 'ripple', intensity: 1 })` exercise a pane shimmer using the existing audio event path. The legacy `ripple`, `flare`, and `pulse` event names now select different starting shimmer colors.

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
