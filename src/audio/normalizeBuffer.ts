/** Scale buffer so peak amplitude matches target (default ~-3 dBFS). */
export function normalizeAudioBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  targetPeak = 0.7,
): AudioBuffer {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }

  if (peak < 1e-6) return buffer;

  const scale = targetPeak / peak;
  if (scale >= 0.95 && scale <= 1.05) return buffer;

  const normalized = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = normalized.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[i] * scale;
    }
  }
  return normalized;
}

export function bufferPeak(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  return peak;
}
