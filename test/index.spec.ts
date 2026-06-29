import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../worker/index';

describe('Ambience worker', () => {
  it('GET /api/health returns ok', async () => {
    const request = new Request('http://example.com/api/health');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('ambience');
  });

  it('GET /api/tracks returns seed catalog', async () => {
    const request = new Request('http://example.com/api/tracks');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const tracks = (await response.json()) as Array<{ id: string; milieu: string }>;
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.some((t) => t.milieu === 'night')).toBe(true);
  });

  it('GET /api/tracks/:id/manifest returns manifest', async () => {
    const request = new Request('http://example.com/api/tracks/night-deep-calm/manifest');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { manifest: { id: string }; prefix: string };
    expect(body.manifest.id).toBe('night-deep-calm');
    expect(body.prefix).toContain('tracks/night');
  });

  it('GET /api/weather requires lat and lon', async () => {
    const request = new Request('http://example.com/api/weather');
    const response = await SELF.fetch(request);
    expect(response.status).toBe(400);
  });
});
