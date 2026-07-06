# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/

## Project: Ambience

### Environment (`.env`)

Local secrets are in `.env` at the repo root. The generate-tracks script loads this automatically.

| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | ElevenLabs Music + SFX API for track generation |
| `R2_BUCKET_NAME` | R2 bucket for audio (default: `ambience-audio`) |

Cloudflare credentials for R2 upload come from wrangler auth (`wrangler login`).

### Audio tracks

- Seed manifests: `worker/data/seed-tracks.ts`
- Generated files: `.generated-tracks/` (gitignored output)
- R2 bucket: `ambience-audio` (remote binding in `wrangler.jsonc`)

Regenerate and upload a single base track:

```bash
npm run generate-tracks -- --tracks=day-zen-garden --base-only
```

Other flags: `--milieu=day`, `--chimes-only`, `--engine=music|sfx-stitch|auto`
