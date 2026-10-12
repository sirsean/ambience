export const MAX_RENDER_PIXELS = 1_250_000;
export const RENDER_FRAME_MS = 1000 / 30;

export function drawingSize(width: number, height: number, devicePixelRatio = 1) {
  const scale = Math.min(1, devicePixelRatio, Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height)));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}
