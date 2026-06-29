import { ChimeScheduler } from './ChimeScheduler';
import type { ChimeEvent, Milieu, TrackManifest } from './types';

type ChimeListener = (event: ChimeEvent) => void;

export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private loopSource: AudioBufferSourceNode | null = null;
  private baseBuffer: AudioBuffer | null = null;
  private readonly frequencyData: Uint8Array;
  private chimeScheduler: ChimeScheduler | null = null;
  private readonly chimeListeners = new Set<ChimeListener>();
  private currentManifest: TrackManifest | null = null;
  private trackPrefix = '';
  private milieu: Milieu = 'day';
  private targetGain = 0.55;
  private currentGain = 0;
  private playbackGeneration = 0;

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

  async start(manifest: TrackManifest, trackPrefix: string, milieu: Milieu): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.gainNode = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.chimeScheduler = new ChimeScheduler(this.context, this.gainNode);
      this.wireChimeListeners();
    }

    await this.context.resume();
    await this.loadTrack(manifest, trackPrefix, milieu);
  }

  async loadTrack(manifest: TrackManifest, trackPrefix: string, milieu: Milieu): Promise<void> {
    if (!this.context || !this.gainNode || !this.chimeScheduler) return;

    this.playbackGeneration += 1;
    this.stopLoop();
    this.chimeScheduler.stop();
    this.baseBuffer = null;

    this.currentManifest = manifest;
    this.trackPrefix = trackPrefix;
    this.milieu = milieu;

    const loopUrl = `/api/audio/${trackPrefix}/${manifest.baseLoop}`;
    let buffer: AudioBuffer | null = null;

    try {
      const response = await fetch(loopUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
      }
    } catch {
      // Fall through to procedural loop
    }

    if (buffer) {
      this.baseBuffer = buffer;
      this.startBasePlayback(buffer, this.playbackGeneration);
    } else {
      this.startProceduralLoop();
    }

    await this.chimeScheduler.configure(manifest, trackPrefix, milieu);
    this.chimeScheduler.start();
    this.fadeIn();
  }

  setMilieu(milieu: Milieu): void {
    this.milieu = milieu;
    this.chimeScheduler?.setMilieu(milieu);
  }

  crossfadeMilieu(durationSec = 90): void {
    if (!this.gainNode || !this.context) return;
    const now = this.context.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(this.targetGain * 0.3, now + durationSec * 0.4);
    this.gainNode.gain.linearRampToValueAtTime(this.targetGain, now + durationSec);
  }

  stop(): void {
    this.playbackGeneration += 1;
    this.chimeScheduler?.stop();
    this.stopLoop();
    this.baseBuffer = null;
    if (this.gainNode && this.context) {
      this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  private fadeIn(): void {
    if (!this.gainNode || !this.context) return;
    const now = this.context.currentTime;
    this.currentGain = 0;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(0, now);
    this.gainNode.gain.linearRampToValueAtTime(this.targetGain, now + 3);
    this.currentGain = this.targetGain;
  }

  private startBasePlayback(buffer: AudioBuffer, generation: number): void {
    if (!this.context || !this.gainNode || !this.currentManifest) return;

    const shouldLoop = this.currentManifest.playback?.loop ?? true;
    const crossfadeSec = this.currentManifest.playback?.restartCrossfadeSec ?? 4;

    this.loopSource = this.context.createBufferSource();
    this.loopSource.buffer = buffer;
    this.loopSource.loop = shouldLoop;
    this.loopSource.connect(this.gainNode);
    this.loopSource.start();

    if (!shouldLoop) {
      this.loopSource.onended = () => {
        if (generation !== this.playbackGeneration || !this.baseBuffer || !this.context || !this.gainNode) {
          return;
        }
        this.restartBaseTrack(crossfadeSec, generation);
      };
    }
  }

  private restartBaseTrack(crossfadeSec: number, generation: number): void {
    if (!this.context || !this.gainNode || !this.baseBuffer || generation !== this.playbackGeneration) return;

    const now = this.context.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + crossfadeSec * 0.5);

    window.setTimeout(() => {
      if (generation !== this.playbackGeneration || !this.baseBuffer) return;
      this.stopLoop();
      this.startBasePlayback(this.baseBuffer, generation);
      if (this.gainNode && this.context) {
        const resumeAt = this.context.currentTime;
        this.gainNode.gain.cancelScheduledValues(resumeAt);
        this.gainNode.gain.setValueAtTime(0, resumeAt);
        this.gainNode.gain.linearRampToValueAtTime(this.targetGain, resumeAt + crossfadeSec);
      }
    }, crossfadeSec * 500);
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
  }

  private startProceduralLoop(): void {
    if (!this.context || !this.gainNode) return;

    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    const loopGain = this.context.createGain();

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

    osc1.connect(loopGain);
    osc2.connect(loopGain);
    loopGain.gain.value = 0.04;
    loopGain.connect(this.gainNode);

    osc1.start();
    osc2.start();
    lfo.start();

    this.loopSource = osc1 as unknown as AudioBufferSourceNode;
  }
}
