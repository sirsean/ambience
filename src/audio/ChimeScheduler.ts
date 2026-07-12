import type { ChimeDefinition, ChimeEvent, Milieu } from './types';
import { audioLog } from './audioLog';

type ChimeListener = (event: ChimeEvent) => void;

const CHIME_VOLUME: Record<Milieu, number> = {
  night: 0.05,
  sunrise: 0.14,
  day: 0.1,
};

export interface ChimeSource {
  id: string;
  definition: ChimeDefinition;
  prefix: string;
}

export class ChimeScheduler {
  private readonly context: AudioContext;
  private readonly destination: AudioNode;
  private allSources: ChimeSource[] = [];
  private defaultChimeIds: string[] = [];
  private activeChimeIds: string[] | null = null;
  private scheduleConfig = { minIntervalSec: 60, maxIntervalSec: 120 };
  private milieu: Milieu = 'day';
  private trackId = '';
  private buffers = new Map<string, AudioBuffer>();
  private volumeMultiplier = 1;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private listeners = new Set<ChimeListener>();

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.destination = destination;
  }

  onChime(listener: ChimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setVolumeMultiplier(multiplier: number): void {
    this.volumeMultiplier = Math.min(1, Math.max(0, multiplier));
  }

  setActiveChimes(ids: string[] | null): void {
    this.activeChimeIds = ids;
  }

  async setSources(
    sources: ChimeSource[],
    defaultIds: string[],
    schedule: { minIntervalSec: number; maxIntervalSec: number },
  ): Promise<Array<{ id: string; ok: boolean; error?: string }>> {
    this.allSources = sources;
    this.defaultChimeIds = defaultIds;
    this.scheduleConfig = schedule;

    const results = await Promise.all(
      sources.map(async (source) => {
        if (this.buffers.has(source.id)) {
          return { id: source.id, ok: true };
        }

        const url = `/api/audio/${source.prefix}/${source.definition.file}`;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return { id: source.id, ok: false, error: `HTTP ${response.status}` };
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
          this.buffers.set(source.id, buffer);
          return { id: source.id, ok: true };
        } catch (err) {
          return {
            id: source.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    for (const result of results) {
      if (!result.ok) {
        audioLog('Chime load FAILED — will skip audio (visual only)', {
          trackId: this.trackId,
          chimeId: result.id,
          error: result.error,
        });
      }
    }

    return results;
  }

  async configure(
    trackId: string,
    milieu: Milieu,
    sources: ChimeSource[],
    defaultIds: string[],
    schedule: { minIntervalSec: number; maxIntervalSec: number },
  ): Promise<Array<{ id: string; ok: boolean; error?: string }>> {
    this.stop();
    this.trackId = trackId;
    this.milieu = milieu;
    return this.setSources(sources, defaultIds, schedule);
  }

  start(): void {
    if (this.running || this.getActivePool().length === 0) return;
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  setMilieu(milieu: Milieu): void {
    this.milieu = milieu;
  }

  getDefaultChimeIds(): string[] {
    return [...this.defaultChimeIds];
  }

  private getActivePool(): ChimeSource[] {
    const ids = this.activeChimeIds ?? this.defaultChimeIds;
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    return this.allSources.filter((s) => idSet.has(s.id));
  }

  fireChime(overrides?: Partial<Pick<ChimeDefinition, 'visualEvent' | 'intensity'>>): void {
    const pool = this.getActivePool();
    if (pool.length === 0) return;

    const source =
      pool.find((s) => s.definition.visualEvent === overrides?.visualEvent) ??
      pool[Math.floor(Math.random() * pool.length)];

    const chime = source.definition;
    const visualEvent = overrides?.visualEvent ?? chime.visualEvent;
    const intensity = overrides?.intensity ?? chime.intensity;
    const buffer = this.buffers.get(chime.id);
    const volume = CHIME_VOLUME[this.milieu] * intensity * this.volumeMultiplier;

    const emit = () => {
      const event: ChimeEvent = {
        chimeId: chime.id,
        visualEvent,
        intensity,
        milieu: this.milieu,
      };
      for (const listener of this.listeners) listener(event);
    };

    if (buffer) {
      audioLog('Chime playing (R2 audio)', {
        trackId: this.trackId,
        chimeId: chime.id,
        visualEvent,
        intensity,
        volume: volume.toFixed(3),
        durationSec: buffer.duration.toFixed(2),
      });
      const gain = this.context.createGain();
      const sourceNode = this.context.createBufferSource();
      sourceNode.buffer = buffer;
      gain.gain.value = volume;
      sourceNode.connect(gain);
      gain.connect(this.destination);
      sourceNode.start();
      emit();
      return;
    }

    audioLog('Chime SKIPPED — no audio buffer (visual only)', {
      trackId: this.trackId,
      chimeId: chime.id,
      visualEvent,
      intensity,
      note: 'Previously this played a loud 440Hz procedural tone',
    });
    emit();
  }

  private scheduleNext(): void {
    if (!this.running) return;

    const { minIntervalSec, maxIntervalSec } = this.scheduleConfig;
    let min = minIntervalSec;
    let max = maxIntervalSec;
    if (this.milieu === 'night') {
      min = Math.max(min, 90);
      max = Math.max(max, 240);
    }

    const delaySec = min + Math.random() * (max - min);
    const delayMs = delaySec * 1000;

    audioLog('Chime scheduled', {
      trackId: this.trackId,
      inSec: delaySec.toFixed(1),
      milieu: this.milieu,
    });

    this.timeoutId = setTimeout(() => {
      this.fireChime();
      this.scheduleNext();
    }, delayMs);
  }
}
