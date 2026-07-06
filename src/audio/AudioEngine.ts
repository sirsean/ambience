import { ChimeScheduler } from './ChimeScheduler';
import { audioLog } from './audioLog';
import { bufferPeak, normalizeAudioBuffer } from './normalizeBuffer';
import type { ChimeEvent, Milieu, TrackManifest, VisualEvent } from './types';

type ChimeListener = (event: ChimeEvent) => void;

const MASTER_GAIN = 0.55;
const FADE_IN_SEC = 2.5;
const TRACK_CROSSFADE_SEC = 2;

export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private loopGain: GainNode | null = null;
  private chimeGain: GainNode | null = null;
  private loopSource: AudioBufferSourceNode | null = null;
  private loopSourceGain: GainNode | null = null;
  private baseBuffer: AudioBuffer | null = null;
  private readonly frequencyData: Uint8Array;
  private chimeScheduler: ChimeScheduler | null = null;
  private readonly chimeListeners = new Set<ChimeListener>();
  private currentManifest: TrackManifest | null = null;
  private trackPrefix = '';
  private milieu: Milieu = 'day';
  private playbackGeneration = 0;
  private hasEntered = false;

  constructor() {
    this.frequencyData = new Uint8Array(128);
  }

  get audioLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.frequencyData);
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (this.frequencyData.length * 255);
  }

  onChime(listener: ChimeListener): () => void {
    this.chimeListeners.add(listener);
    const unsubscribe = this.chimeScheduler?.onChime(listener);
    return () => {
      this.chimeListeners.delete(listener);
      unsubscribe?.();
    };
  }

  private wireChimeListeners(): void {
    if (!this.chimeScheduler) return;
    for (const listener of this.chimeListeners) {
      this.chimeScheduler.onChime(listener);
    }
  }

  private ensureContext(): void {
    if (this.context) return;

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.loopGain = this.context.createGain();
    this.chimeGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.85;

    this.loopGain.connect(this.masterGain);
    this.chimeGain.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    this.chimeScheduler = new ChimeScheduler(this.context, this.chimeGain);
    this.wireChimeListeners();
    audioLog('AudioContext initialized');
  }

  async start(
    manifest: TrackManifest,
    trackPrefix: string,
    milieu: Milieu,
    options?: { reason?: string },
  ): Promise<void> {
    this.ensureContext();
    await this.context!.resume();
    await this.loadTrack(manifest, trackPrefix, milieu, options);
  }

  async loadTrack(
    manifest: TrackManifest,
    trackPrefix: string,
    milieu: Milieu,
    options?: { reason?: string },
  ): Promise<void> {
    if (!this.context || !this.masterGain || !this.loopGain || !this.chimeGain || !this.chimeScheduler) {
      return;
    }

    const reason = options?.reason ?? 'unknown';
    const previousTrackId = this.currentManifest?.id ?? null;
    const isFirstEnter = reason === 'enter' && !this.hasEntered;

    this.playbackGeneration += 1;
    const generation = this.playbackGeneration;
    this.stopLoop();
    this.chimeScheduler.stop();

    this.currentManifest = manifest;
    this.trackPrefix = trackPrefix;
    this.milieu = milieu;

    const loopUrl = `/api/audio/${trackPrefix}/${manifest.baseLoop}`;
    audioLog('Track load started', {
      reason,
      trackId: manifest.id,
      trackName: manifest.name,
      previousTrackId,
      milieu,
      url: loopUrl,
      playback: manifest.playback ?? { loop: true },
    });

    let buffer: AudioBuffer | null = null;
    let fetchStatus: number | null = null;
    let fetchError: string | null = null;

    try {
      const response = await fetch(loopUrl);
      fetchStatus = response.status;
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await this.context.decodeAudioData(arrayBuffer.slice(0));
        const peakBefore = bufferPeak(decoded);
        buffer = normalizeAudioBuffer(this.context, decoded);
        audioLog('Base track normalized', {
          trackId: manifest.id,
          peakBefore: peakBefore.toFixed(3),
          peakAfter: bufferPeak(buffer).toFixed(3),
        });
      } else {
        fetchError = `HTTP ${response.status}`;
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }

    if (buffer) {
      this.baseBuffer = buffer;
      audioLog('Base track loaded', {
        trackId: manifest.id,
        durationSec: buffer.duration.toFixed(1),
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
      });
      this.startBasePlayback(buffer, generation);
    } else {
      audioLog('Base track FAILED — using procedural fallback', {
        trackId: manifest.id,
        url: loopUrl,
        fetchStatus,
        fetchError,
      });
      this.startProceduralLoop();
    }

    const chimeResults = await this.chimeScheduler.configure(manifest, trackPrefix, milieu);
    this.chimeScheduler.start();
    this.applyMasterGain(isFirstEnter, reason);
    this.hasEntered = true;

    audioLog('Track load complete', {
      trackId: manifest.id,
      reason,
      baseSource: buffer ? 'r2' : 'procedural',
      chimes: chimeResults,
    });
  }

  setMilieu(milieu: Milieu): void {
    if (this.milieu !== milieu) {
      audioLog('Milieu updated (audio continues on current track)', {
        trackId: this.currentManifest?.id,
        from: this.milieu,
        to: milieu,
      });
    }
    this.milieu = milieu;
    this.chimeScheduler?.setMilieu(milieu);
  }

  triggerChime(overrides?: { visualEvent?: VisualEvent; intensity?: number }): void {
    this.chimeScheduler?.fireChime(overrides);
  }

  stop(): void {
    this.playbackGeneration += 1;
    this.chimeScheduler?.stop();
    this.stopLoop();
    this.baseBuffer = null;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  private applyMasterGain(fromZero: boolean, reason: string): void {
    if (!this.masterGain || !this.context) return;

    const now = this.context.currentTime;
    const current = this.masterGain.gain.value;
    const duration = fromZero ? FADE_IN_SEC : TRACK_CROSSFADE_SEC;

    audioLog('Master gain transition', {
      trackId: this.currentManifest?.id,
      reason,
      fromZero,
      fromGain: current.toFixed(3),
      toGain: MASTER_GAIN,
      durationSec: duration,
    });

    this.masterGain.gain.cancelScheduledValues(now);
    if (fromZero) {
      this.masterGain.gain.setValueAtTime(0, now);
    } else {
      this.masterGain.gain.setValueAtTime(current, now);
    }
    this.masterGain.gain.linearRampToValueAtTime(MASTER_GAIN, now + duration);
  }

  private startBasePlayback(buffer: AudioBuffer, generation: number): void {
    if (!this.context || !this.loopGain || !this.currentManifest) return;

    const shouldLoop = true;
    const crossfadeSec = this.currentManifest.playback?.restartCrossfadeSec ?? 4;

    this.loopSourceGain = this.context.createGain();
    this.loopSourceGain.gain.value = 1;
    this.loopSource = this.context.createBufferSource();
    this.loopSource.buffer = buffer;
    this.loopSource.loop = shouldLoop;
    this.loopSource.connect(this.loopSourceGain);
    this.loopSourceGain.connect(this.loopGain);
    this.loopSource.start();

    audioLog('Base playback started', {
      trackId: this.currentManifest.id,
      loop: shouldLoop,
      durationSec: buffer.duration.toFixed(1),
      restartCrossfadeSec: shouldLoop ? null : crossfadeSec,
    });

    if (!shouldLoop) {
      this.loopSource.onended = () => {
        if (generation !== this.playbackGeneration || !this.baseBuffer || !this.context || !this.loopGain) {
          return;
        }
        audioLog('Base track ended — seamless overlap restart', {
          trackId: this.currentManifest?.id,
          crossfadeSec,
        });
        this.overlapRestart(crossfadeSec, generation);
      };
    }
  }

  /** Overlap a new playthrough before the old one ends — no silence gap. */
  private overlapRestart(crossfadeSec: number, generation: number): void {
    if (!this.context || !this.loopGain || !this.baseBuffer || generation !== this.playbackGeneration) return;

    const oldSource = this.loopSource;
    const oldGain = this.loopSourceGain;

    const newSource = this.context.createBufferSource();
    newSource.buffer = this.baseBuffer;
    newSource.loop = false;

    const newGain = this.context.createGain();
    newGain.gain.value = 0;
    newSource.connect(newGain);
    newGain.connect(this.loopGain);

    const now = this.context.currentTime;
    newSource.start(now);
    newGain.gain.linearRampToValueAtTime(1, now + crossfadeSec);

    if (oldGain) {
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + crossfadeSec);
    }

    this.loopSource = newSource;
    this.loopSourceGain = newGain;

    window.setTimeout(() => {
      if (oldSource) {
        try {
          oldSource.stop();
        } catch {
          // already stopped
        }
        oldSource.disconnect();
      }
      oldGain?.disconnect();
    }, crossfadeSec * 1000 + 50);

    newSource.onended = () => {
      if (generation !== this.playbackGeneration || !this.baseBuffer) return;
      this.overlapRestart(crossfadeSec, generation);
    };
  }

  private stopLoop(): void {
    if (this.loopSource) {
      this.loopSource.onended = null;
      try {
        this.loopSource.stop();
      } catch {
        // Already stopped
      }
      this.loopSource.disconnect();
      this.loopSource = null;
    }
    if (this.loopSourceGain) {
      this.loopSourceGain.disconnect();
      this.loopSourceGain = null;
    }
  }

  private startProceduralLoop(): void {
    if (!this.context || !this.loopGain) return;

    audioLog('Procedural loop started (fetch failed — not a R2 track)', {
      trackId: this.currentManifest?.id,
      milieu: this.milieu,
    });

    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    const synthGain = this.context.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 8;

    const baseFreq = this.milieu === 'night' ? 55 : this.milieu === 'sunrise' ? 82 : 65;
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq * 1.5;

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(synthGain);
    osc2.connect(synthGain);
    synthGain.gain.value = 0.025;
    synthGain.connect(this.loopGain);

    osc1.start();
    osc2.start();
    lfo.start();

    this.loopSource = osc1 as unknown as AudioBufferSourceNode;
  }
}
