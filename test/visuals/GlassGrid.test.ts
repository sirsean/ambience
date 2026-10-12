import { describe, expect, it } from 'vitest';
import { GlassGrid, GLASS_PANE_COUNT, GRID_COLUMNS, GRID_ROWS } from '../../src/visuals/GlassGrid';
import { drawingSize, MAX_RENDER_PIXELS } from '../../src/visuals/renderBudget';

describe('moving glass grid', () => {
  it('keeps all 48 panes visible and tiles the entire screen throughout a day', () => {
    const grid = new GlassGrid();
    const buffer = grid.rects;
    for (let time = 0; time <= 86_400; time += 137) {
      grid.update(time);
      expect(grid.rects).toBe(buffer);
      expect(grid.rects.length / 4).toBe(GLASS_PANE_COUNT);
      let area = 0;
      let rightEdge = 0;
      for (let column = 0; column < GRID_COLUMNS; column++) {
        let topEdge = 0;
        const columnOffset = column * GRID_ROWS * 4;
        const width = buffer[columnOffset + 2];
        expect(buffer[columnOffset]).toBeCloseTo(rightEdge, 6);
        for (let row = 0; row < GRID_ROWS; row++) {
          const offset = columnOffset + row * 4;
          const [x, y, w, h] = buffer.subarray(offset, offset + 4);
          expect(x).toBeCloseTo(rightEdge, 6);
          expect(y).toBeCloseTo(topEdge, 6);
          expect(w).toBe(width);
          expect(w).toBeGreaterThan(0.05);
          expect(h).toBeGreaterThan(0.05);
          expect(x + w).toBeLessThanOrEqual(1.000001);
          expect(y + h).toBeLessThanOrEqual(1.000001);
          area += w * h;
          topEdge = y + h;
        }
        expect(topEdge).toBeCloseTo(1, 6);
        rightEdge = buffer[columnOffset] + width;
      }
      expect(rightEdge).toBeCloseTo(1, 6);
      expect(area).toBeCloseTo(1, 6);
    }
  });

  it('moves continuously and reaches the same layout after skipped frames', () => {
    const regular = new GlassGrid();
    const skipped = new GlassGrid();
    const initial = Array.from(regular.rects);
    for (let frame = 0; frame <= 900; frame++) regular.update(frame / 30);
    skipped.update(30);
    expect(Array.from(regular.rects)).toEqual(Array.from(skipped.rects));
    expect(Array.from(regular.rects)).not.toEqual(initial);
    const previous = regular.rects.slice();
    regular.update(30 + 1 / 30);
    for (let index = 0; index < previous.length; index++) {
      expect(Math.abs(regular.rects[index] - previous[index])).toBeLessThan(0.001);
    }
  });
});

describe('render pixel budget', () => {
  it.each([
    [1366, 768, 1], [1366, 768, 2], [1920, 1080, 2], [3840, 2160, 3],
    [320, 640, 3], [768, 1366, 2], [1000, 1000, 0.8],
  ])('caps %ix%i at DPR %s while preserving its aspect ratio', (width, height, dpr) => {
    const size = drawingSize(width, height, dpr);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_RENDER_PIXELS);
    expect(size.width).toBeLessThanOrEqual(width);
    expect(size.height).toBeLessThanOrEqual(height);
    expect(size.scale).toBeLessThanOrEqual(Math.min(1, dpr));
    expect(Math.abs(size.width - size.height * width / height)).toBeLessThan(2);
  });

  it('uses CSS resolution on a high-density Chromebook instead of doubling both dimensions', () => {
    expect(drawingSize(1366, 768, 2)).toEqual({ width: 1366, height: 768, scale: 1 });
  });
});
