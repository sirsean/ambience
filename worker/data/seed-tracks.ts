import type { Milieu, TrackManifest, TrackSummary } from '../../src/audio/types';

export interface SeedTrack {
  prefix: string;
  manifest: TrackManifest;
}

export const SEED_TRACKS: SeedTrack[] = [
  {
    prefix: 'tracks/night/deep-calm',
    manifest: {
      id: 'night-deep-calm',
      name: 'Deep Calm',
      milieu: 'night',
      baseLoop: 'base_track.mp3',
      playback: { loop: true, restartCrossfadeSec: 5 },
      chimePool: [
        { id: 'soft-bell-1', file: 'chimes/soft-bell-1.mp3', visualEvent: 'ripple', intensity: 0.5 },
        { id: 'distant-chime', file: 'chimes/distant-chime.mp3', visualEvent: 'ripple', intensity: 0.35 },
      ],
      schedule: { minIntervalSec: 45, maxIntervalSec: 180 },
    },
  },
  {
    prefix: 'tracks/night/starry-drone',
    manifest: {
      id: 'night-starry-drone',
      name: 'Starry Drone',
      milieu: 'night',
      baseLoop: 'base_track.mp3',
      playback: { loop: true, restartCrossfadeSec: 5 },
      chimePool: [
        { id: 'soft-bell-2', file: 'chimes/soft-bell-2.mp3', visualEvent: 'pulse', intensity: 0.4 },
      ],
      schedule: { minIntervalSec: 60, maxIntervalSec: 200 },
    },
  },
  {
    prefix: 'tracks/sunrise/golden-awake',
    manifest: {
      id: 'sunrise-golden-awake',
      name: 'Golden Awake',
      milieu: 'sunrise',
      baseLoop: 'base_track.mp3',
      playback: { loop: true, restartCrossfadeSec: 5 },
      chimePool: [
        { id: 'soft-morning-bell', file: 'chimes/soft-morning-bell.mp3', visualEvent: 'flare', intensity: 0.5 },
        { id: 'gentle-wind-chime', file: 'chimes/gentle-wind-chime.mp3', visualEvent: 'flare', intensity: 0.45 },
      ],
      schedule: { minIntervalSec: 30, maxIntervalSec: 120 },
    },
  },
  {
    prefix: 'tracks/sunrise/early-light',
    manifest: {
      id: 'sunrise-early-light',
      name: 'Early Light',
      milieu: 'sunrise',
      baseLoop: 'base_track.mp3',
      playback: { loop: true, restartCrossfadeSec: 5 },
      chimePool: [
        { id: 'gentle-morning-bell', file: 'chimes/gentle-morning-bell.mp3', visualEvent: 'flare', intensity: 0.45 },
      ],
      schedule: { minIntervalSec: 40, maxIntervalSec: 140 },
    },
  },
  {
    prefix: 'tracks/day/zen-garden',
    manifest: {
      id: 'day-zen-garden',
      name: 'Zen Garden',
      milieu: 'day',
      baseLoop: 'base_track.mp3',
      playback: { loop: true, restartCrossfadeSec: 5 },
      chimePool: [
        { id: 'singing-bowl', file: 'chimes/singing-bowl.mp3', visualEvent: 'pulse', intensity: 0.55 },
        { id: 'soft-gong', file: 'chimes/soft-gong.mp3', visualEvent: 'ripple', intensity: 0.45 },
      ],
      schedule: { minIntervalSec: 50, maxIntervalSec: 160 },
    },
  },
  {
    prefix: 'tracks/day/contemplation',
    manifest: {
      id: 'day-contemplation',
      name: 'Contemplation',
      milieu: 'day',
      baseLoop: 'base_track.mp3',
      playback: { loop: true, restartCrossfadeSec: 5 },
      chimePool: [
        { id: 'meditation-bell', file: 'chimes/meditation-bell.mp3', visualEvent: 'pulse', intensity: 0.5 },
      ],
      schedule: { minIntervalSec: 55, maxIntervalSec: 170 },
    },
  },
];

export function listSeedTracks(milieu?: Milieu): TrackSummary[] {
  const tracks = SEED_TRACKS.map(({ manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    milieu: manifest.milieu,
  }));
  return milieu ? tracks.filter((t) => t.milieu === milieu) : tracks;
}

export function getSeedTrack(id: string): SeedTrack | undefined {
  return SEED_TRACKS.find((t) => t.manifest.id === id);
}
