import type { Milieu } from '../audio/types';

export type ModePreference = 'auto' | Milieu;

export type ChimeSelectionMode = 'auto' | 'custom';

export interface ChimeSelection {
  mode: ChimeSelectionMode;
  /** Active chime ids when mode is `custom`. */
  enabledIds: string[];
}

export interface MilieuVolumes {
  music: number;
  chime: number;
}

export interface UserPreferences {
  mode: ModePreference;
  volumes: Record<Milieu, MilieuVolumes>;
  /** Selected track id per milieu. */
  tracks: Record<Milieu, string | null>;
  chimes: Record<Milieu, ChimeSelection>;
}

const STORAGE_KEY = 'ambience-preferences';
const LEGACY_TRACK_KEY = 'ambience-selected-track';

const MILIEUS: Milieu[] = ['night', 'sunrise', 'day'];

const DEFAULT_CHIME_SELECTION: ChimeSelection = { mode: 'auto', enabledIds: [] };
const DEFAULT_MILIEU_VOLUMES: MilieuVolumes = { music: 1, chime: 1 };

export const DEFAULT_PREFERENCES: UserPreferences = {
  mode: 'auto',
  volumes: {
    night: { ...DEFAULT_MILIEU_VOLUMES },
    sunrise: { ...DEFAULT_MILIEU_VOLUMES },
    day: { ...DEFAULT_MILIEU_VOLUMES },
  },
  tracks: { night: null, sunrise: null, day: null },
  chimes: {
    night: { ...DEFAULT_CHIME_SELECTION },
    sunrise: { ...DEFAULT_CHIME_SELECTION },
    day: { ...DEFAULT_CHIME_SELECTION },
  },
};

function isMilieu(value: unknown): value is Milieu {
  return value === 'night' || value === 'sunrise' || value === 'day';
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function parseChimeSelection(raw: unknown): ChimeSelection {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CHIME_SELECTION };
  const obj = raw as Record<string, unknown>;
  const mode = obj.mode === 'custom' ? 'custom' : 'auto';
  const enabledIds = Array.isArray(obj.enabledIds)
    ? obj.enabledIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { mode, enabledIds };
}

function parseMilieuVolumes(raw: unknown, fallback: MilieuVolumes): MilieuVolumes {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const obj = raw as Record<string, unknown>;
  return {
    music: clampVolume(obj.music, fallback.music),
    chime: clampVolume(obj.chime, fallback.chime),
  };
}

function parseVolumes(
  raw: unknown,
  legacyMusic?: unknown,
  legacyChime?: unknown,
): Record<Milieu, MilieuVolumes> {
  const legacyFallback: MilieuVolumes = {
    music: clampVolume(legacyMusic, DEFAULT_MILIEU_VOLUMES.music),
    chime: clampVolume(legacyChime, DEFAULT_MILIEU_VOLUMES.chime),
  };

  if (!raw || typeof raw !== 'object') {
    return {
      night: { ...legacyFallback },
      sunrise: { ...legacyFallback },
      day: { ...legacyFallback },
    };
  }

  const obj = raw as Record<string, unknown>;
  return {
    night: parseMilieuVolumes(obj.night, legacyFallback),
    sunrise: parseMilieuVolumes(obj.sunrise, legacyFallback),
    day: parseMilieuVolumes(obj.day, legacyFallback),
  };
}

function migrateLegacyTrack(prefs: UserPreferences): UserPreferences {
  const legacy = localStorage.getItem(LEGACY_TRACK_KEY);
  if (!legacy) return prefs;

  const hasAnyTrack = MILIEUS.some((m) => prefs.tracks[m] !== null);
  if (hasAnyTrack) return prefs;

  for (const milieu of MILIEUS) {
    prefs.tracks[milieu] = legacy;
  }
  return prefs;
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateLegacyTrack(structuredClone(DEFAULT_PREFERENCES));
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const tracksRaw = (parsed.tracks ?? {}) as Record<string, unknown>;
    const chimesRaw = (parsed.chimes ?? {}) as Record<string, unknown>;

    const prefs: UserPreferences = {
      mode:
        parsed.mode === 'auto' || isMilieu(parsed.mode) ? parsed.mode : DEFAULT_PREFERENCES.mode,
      volumes: parseVolumes(parsed.volumes, parsed.musicVolume, parsed.chimeVolume),
      tracks: {
        night: typeof tracksRaw.night === 'string' ? tracksRaw.night : null,
        sunrise: typeof tracksRaw.sunrise === 'string' ? tracksRaw.sunrise : null,
        day: typeof tracksRaw.day === 'string' ? tracksRaw.day : null,
      },
      chimes: {
        night: parseChimeSelection(chimesRaw.night),
        sunrise: parseChimeSelection(chimesRaw.sunrise),
        day: parseChimeSelection(chimesRaw.day),
      },
    };

    return migrateLegacyTrack(prefs);
  } catch {
    return migrateLegacyTrack(structuredClone(DEFAULT_PREFERENCES));
  }
}

export function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function updatePreferences(patch: Partial<UserPreferences>): UserPreferences {
  const current = loadPreferences();
  const next: UserPreferences = {
    ...current,
    ...patch,
    volumes: {
      night: { ...current.volumes.night, ...patch.volumes?.night },
      sunrise: { ...current.volumes.sunrise, ...patch.volumes?.sunrise },
      day: { ...current.volumes.day, ...patch.volumes?.day },
    },
    tracks: { ...current.tracks, ...patch.tracks },
    chimes: { ...current.chimes, ...patch.chimes },
  };
  savePreferences(next);
  return next;
}

export function getEffectiveMilieu(mode: ModePreference, autoMilieu: Milieu): Milieu {
  return mode === 'auto' ? autoMilieu : mode;
}

export function chimeLabel(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
