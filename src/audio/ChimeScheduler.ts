import type { ChimeDefinition, ChimeEvent, Milieu, TrackManifest } from './types';
import { audioLog } from './audioLog';

type ChimeListener = (event: ChimeEvent) => void;

const CHIME_VOLUME: Record<Milieu, number> = {
  night: 0.05,
  sunrise: 0.14,
  day: 0.1,
};

export class ChimeScheduler {
  private readonly context: AudioContext;
  private readonly destination: AudioNode;
  private chimePool: ChimeDefinition[] = [];
  private scheduleConfig = { minIntervalSec: 60, maxIntervalSec: 120 };
  private milieu: Milieu = 'day';
  private trackPrefix = '';
  private trackId = '';
  private buffers = new Map<string, AudioBuffer>();
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

  async configure(
    manifest: TrackManifest,
    trackPrefix: string,
    milieu: Milieu,
  ): Promise<Array<{ id: string; ok: boolean; error?: string }>> {
    this.stop();
    this.chimePool = manifest.chimePool;
    this.scheduleConfig = manifest.schedule;
    this.trackPrefix = trackPrefix;
    this.trackId = manifest.id;
    this.milieu = milieu;
    this.buffers.clear();

    const results = await Promise.all(
      manifest.chimePool.map(async (chime) => {
        const url = `/api/audio/${trackPrefix}/${chime.file}`;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return { id: chime.id, ok: false, error: `HTTP ${response.status}` };
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
          this.buffers.set(chime.id, buffer);
          return { id: chime.id, ok: true };
        } catch (err) {
          return {
            id: chime.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    for (const result of results) {
      if (!result.ok) {
        audioLog('Chime load FAILED — will skip audio (visual only)', {
          trackId: manifest.id,
          chimeId: result.id,
          error: result.error,
        });
      }
    }

    return results;
  }

  start(): void {
    if (this.running || this.chimePool.length === 0) return;
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

  fireChime(overrides?: Partial<Pick<ChimeDefinition, 'visualEvent' | 'intensity'>>): void {
    if (this.chimePool.length === 0) return;

    const chime =
      this.chimePool.find((c) => c.visualEvent === overrides?.visualEvent) ??
      this.chimePool[Math.floor(Math.random() * this.chimePool.length)];

    const visualEvent = overrides?.visualEvent ?? chime.visualEvent;
    const intensity = overrides?.intensity ?? chime.intensity;
    const buffer = this.buffers.get(chime.id);
    const volume = CHIME_VOLUME[this.milieu] * intensity;

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
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.destination);
      source.start();
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
