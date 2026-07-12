import type { ChimeDefinition, Milieu, TrackSummary } from '../audio/types';
import { fetchTrackManifest } from './api';

export interface ChimeCatalogEntry extends ChimeDefinition {
  milieu: Milieu;
  trackId: string;
  prefix: string;
}

export type ChimeCatalog = Record<Milieu, ChimeCatalogEntry[]>;

function upsertEntry(catalog: ChimeCatalog, entry: ChimeCatalogEntry): void {
  const list = catalog[entry.milieu];
  if (list.some((c) => c.id === entry.id)) return;
  list.push(entry);
}

export async function buildChimeCatalog(tracks: TrackSummary[]): Promise<ChimeCatalog> {
  const catalog: ChimeCatalog = { night: [], sunrise: [], day: [] };

  await Promise.all(
    tracks.map(async (track) => {
      try {
        const { manifest, prefix } = await fetchTrackManifest(track.id);
        for (const chime of manifest.chimePool) {
          upsertEntry(catalog, {
            ...chime,
            milieu: track.milieu,
            trackId: track.id,
            prefix,
          });
        }
      } catch {
        // Skip tracks that fail to load during catalog build.
      }
    }),
  );

  for (const milieu of Object.keys(catalog) as Milieu[]) {
    catalog[milieu].sort((a, b) => a.id.localeCompare(b.id));
  }

  return catalog;
}

export function defaultChimeIdsForTrack(manifestChimePool: ChimeDefinition[]): string[] {
  return manifestChimePool.map((c) => c.id);
}
