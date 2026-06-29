import { Hono } from 'hono';

export const audioRoutes = new Hono<{ Bindings: Env }>();

audioRoutes.get('/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/audio\/?/, '');
  if (!key) return c.notFound();

  const obj = await c.env.AUDIO.get(key);
  if (!obj) return c.notFound();

  const rangeHeader = c.req.header('Range');
  const size = obj.size;
  const contentType = obj.httpMetadata?.contentType ?? guessContentType(key);

  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (match) {
      const start = Number.parseInt(match[1], 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
      const length = end - start + 1;
      const body = await obj.slice(start, end + 1);
      return new Response(body.body, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(length),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

function guessContentType(key: string): string {
  if (key.endsWith('.mp3')) return 'audio/mpeg';
  if (key.endsWith('.wav')) return 'audio/wav';
  if (key.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}
