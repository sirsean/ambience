import { useEffect, useRef } from 'react';
import { AmbienceRenderer } from '../visuals/AmbienceRenderer';
import type { MilieuState } from '../hooks/useMilieu';
import type { WeatherModifiers } from '../audio/types';
import type { AudioEngine } from '../audio/AudioEngine';

interface AmbienceCanvasProps {
  milieuState: MilieuState;
  weatherModifiers: WeatherModifiers;
  audioEngine: AudioEngine | null;
  active: boolean;
}

export function AmbienceCanvas({ milieuState, weatherModifiers, audioEngine, active }: AmbienceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AmbienceRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !active) return;

    const renderer = new AmbienceRenderer(containerRef.current);
    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !audioEngine) return;

    const unsubscribe = audioEngine.onChime((event) => {
      renderer.getChimeBridge().trigger(event);
    });

    return unsubscribe;
  }, [audioEngine, active]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.setWeather(weatherModifiers);
    renderer.updateState({
      milieuBlend: {
        from: milieuState.previousMilieu,
        to: milieuState.milieu,
        t: milieuState.blendT,
      },
      weather: weatherModifiers,
    });
  }, [milieuState, weatherModifiers]);

  useEffect(() => {
    if (!active) return;
    let frameId: number;

    const tick = () => {
      const renderer = rendererRef.current;
      if (renderer && audioEngine) {
        renderer.updateState({ audioLevel: audioEngine.audioLevel });
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [audioEngine, active]);

  return <div ref={containerRef} className="ambience-canvas" />;
}
