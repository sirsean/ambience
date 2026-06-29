import type { ChimeDefinition, ChimeEvent, Milieu, TrackManifest } from './types';

type ChimeListener = (event: ChimeEvent) => void;

const CHIME_VOLUME: Record<Milieu, number> = {
  night: 0.08,
  sunrise: 0.32,
  day: 0.28,
};

export class ChimeScheduler {
  private readonly context: AudioContext;
  private readonly destination: AudioNode;
  private chimePool: ChimeDefinition[] = [];
  private scheduleConfig = { minIntervalSec: 60, maxIntervalSec: 120 };
  private milieu: Milieu = 'day';
  private trackPrefix = '';
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

  async configure(manifest: TrackManifest, trackPrefix: string, milieu: Milieu): Promise<void> {
    this.stop();
    this.chimePool = manifest.chimePool;
    this.scheduleConfig = manifest.schedule;
    this.trackPrefix = trackPrefix;
    this.milieu = milieu;
    this.buffers.clear();

    await Promise.all(
      manifest.chimePool.map(async (chime) => {
        const url = `/api/audio/${trackPrefix}/${chime.file}`;
        try {
          const response = await fetch(url);
          if (!response.ok) return;
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
          this.buffers.set(chime.id, buffer);
        } catch {
          // Chime file may not exist yet in dev; procedural fallback handled at play time
        }
      }),
    );
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

  private scheduleNext(): void {
    if (!this.running) return;

    const { minIntervalSec, maxIntervalSec } = this.scheduleConfig;
    let min = minIntervalSec;
    let max = maxIntervalSec;
    if (this.milieu === 'night') {
      min = Math.max(min, 90);
      max = Math.max(max, 240);
    }

    const delayMs = (min + Math.random() * (max - min)) * 1000;

    this.timeoutId = setTimeout(() => {
      this.playRandomChime();
      this.scheduleNext();
    }, delayMs);
  }

  private playRandomChime(): void {
    if (this.chimePool.length === 0) return;

    const chime = this.chimePool[Math.floor(Math.random() * this.chimePool.length)];
    const buffer = this.buffers.get(chime.id);

    const emit = () => {
      const event: ChimeEvent = {
        chimeId: chime.id,
        visualEvent: chime.visualEvent,
        intensity: chime.intensity,
        milieu: this.milieu,
      };
      for (const listener of this.listeners) listener(event);
    };

    const volume = CHIME_VOLUME[this.milieu] * chime.intensity;

    if (buffer) {
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

    this.playProceduralChime(chime.intensity, volume);
    emit();
  }

  private playProceduralChime(intensity: number, volume: number): void {
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    const baseFreq = this.milieu === 'night' ? 330 : 440;
    osc.frequency.setValueAtTime(baseFreq + intensity * 120, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 2.5);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(now);
    osc.stop(now + 3);
  }
}
