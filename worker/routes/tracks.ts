import { Hono } from 'hono';
import { getSeedTrack, listSeedTracks } from '../data/seed-tracks';

export const tracksRoutes = new Hono<{ Bindings: Env }>();

tracksRoutes.get('/', async (c) => {
  const milieu = c.req.query('milieu') as 'night' | 'sunrise' | 'day' | undefined;

  const r2Index = await loadR2Index(c.env.AUDIO);
  if (r2Index.length > 0) {
    const filtered = milieu ? r2Index.filter((t) => t.milieu === milieu) : r2Index;
    return c.json(filtered);
  }

  return c.json(listSeedTracks(milieu));
});

tracksRoutes.get('/:id/manifest', async (c) => {
  const id = c.req.param('id');

  const r2Manifest = await loadR2Manifest(c.env.AUDIO, id);
  if (r2Manifest) return c.json(r2Manifest);

  const seed = getSeedTrack(id);
  if (!seed) return c.notFound();

  return c.json({ manifest: seed.manifest, prefix: seed.prefix });
});

async function loadR2Index(bucket: R2Bucket): Promise<Array<{ id: string; name: string; milieu: string }>> {
  try {
    const obj = await bucket.get('index.json');
    if (!obj) return [];
    const text = await obj.text();
    return JSON.parse(text) as Array<{ id: string; name: string; milieu: string }>;
  } catch {
    return [];
  }
}

async function loadR2Manifest(
  bucket: R2Bucket,
  id: string,
): Promise<{ manifest: unknown; prefix: string } | null> {
  try {
    const listed = await bucket.list({ prefix: 'tracks/' });
    for (const item of listed.objects) {
      if (!item.key.endsWith('/manifest.json')) continue;
      const obj = await bucket.get(item.key);
      if (!obj) continue;
      const manifest = JSON.parse(await obj.text()) as { id: string };
      if (manifest.id === id) {
        const prefix = item.key.replace(/\/manifest\.json$/, '');
        return { manifest, prefix };
      }
    }
  } catch {
    // R2 may be unavailable in some dev setups
  }
  return null;
}
