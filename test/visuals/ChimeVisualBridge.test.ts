import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChimeEvent, VisualEvent } from '../../src/audio/types';
import { ChimeVisualBridge, CHIME_DURATION_MS } from '../../src/visuals/ChimeVisualBridge';
import { GLASS_PANE_COUNT } from '../../src/visuals/GlassGrid';

const event: ChimeEvent = { chimeId: 'test', visualEvent: 'ripple', intensity: 1, milieu: 'day' };

afterEach(() => vi.restoreAllMocks());

describe('pane chime shimmer', () => {
  it.each([15, 30, 60])('expires after 3.6 seconds when rendering at %i fps', (fps) => {
    const bridge = new ChimeVisualBridge();
    bridge.trigger(event, 1000);
    for (let time = 1000; time < 1000 + CHIME_DURATION_MS; time += 1000 / fps) bridge.update(time);
    expect(bridge.update(1000 + CHIME_DURATION_MS - 1).pane).toBeGreaterThanOrEqual(0);
    expect(bridge.update(1000 + CHIME_DURATION_MS).pane).toBe(-1);
    expect(bridge.update(1000 + CHIME_DURATION_MS).amount).toBe(0);
  });

  it('expires on resume after a long gap, without replaying missed animation', () => {
    const bridge = new ChimeVisualBridge();
    bridge.trigger(event, 1000);
    expect(bridge.update(1400).amount).toBeGreaterThan(0);
    expect(bridge.update(61_000).pane).toBe(-1);
  });

  it('keeps its pane identity while its colors shimmer and reuses its state buffer', () => {
    const bridge = new ChimeVisualBridge();
    bridge.trigger(event, 0);
    const state = bridge.update(400);
    const pane = state.pane;
    const colorBuffer = state.color;
    const initialColor = [...state.color];
    const later = bridge.update(2000);
    expect(later).toBe(state);
    expect(later.pane).toBe(pane);
    expect(later.color).toBe(colorBuffer);
    expect(later.color).not.toEqual(initialColor);
    expect(later.amount).toBeGreaterThan(0);
  });

  it('selects valid panes without repeating the previous pane after expiry', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const bridge = new ChimeVisualBridge();
    let previous = -1;
    for (let index = 0; index < 200; index++) {
      bridge.trigger(event, index * 5000);
      const pane = bridge.update(index * 5000 + 500).pane;
      expect(pane).toBeGreaterThanOrEqual(0);
      expect(pane).toBeLessThan(GLASS_PANE_COUNT);
      expect(pane).not.toBe(previous);
      if (index === 0) expect(pane).toBe(GLASS_PANE_COUNT - 1);
      previous = pane;
      bridge.update(index * 5000 + 4000);
    }
  });

  it('replaces an overlapping chime with one selected pane', () => {
    const bridge = new ChimeVisualBridge();
    bridge.trigger(event, 0);
    const previous = bridge.update(500).pane;
    bridge.trigger({ ...event, visualEvent: 'flare' }, 600);
    expect(bridge.update(900).pane).not.toBe(previous);
    expect(bridge.update(900).amount).toBeGreaterThan(0);
    expect(bridge.update(600 + CHIME_DURATION_MS).pane).toBe(-1);
  });

  it.each<VisualEvent>(['ripple', 'flare', 'pulse'])('accepts existing %s audio events and clamps intensity', (visualEvent) => {
    const bridge = new ChimeVisualBridge();
    bridge.trigger({ ...event, visualEvent, intensity: 50 }, 0);
    expect(bridge.update(500).amount).toBeLessThanOrEqual(1);
    expect(bridge.update(500).color.every(value => value >= 0 && value <= 1)).toBe(true);
    expect(bridge.update(0).amount).toBe(0);
    expect(bridge.update(CHIME_DURATION_MS - 1).amount).toBeLessThan(0.001);
  });
});
