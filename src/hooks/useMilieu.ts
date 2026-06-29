import { useEffect, useState } from 'react';
import type { Milieu } from '../audio/types';

export function getMilieu(localHour: number): Milieu {
  if (localHour >= 21 || localHour < 5) return 'night';
  if (localHour >= 5 && localHour < 9) return 'sunrise';
  return 'day';
}

function getLocalHour(): number {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return Number.parseInt(formatter.format(new Date()), 10);
}

export interface MilieuState {
  milieu: Milieu;
  previousMilieu: Milieu;
  blendT: number;
  timezone: string;
}

const CROSSFADE_DURATION_MS = 90_000;

export function useMilieu(): MilieuState {
  const [state, setState] = useState<MilieuState>(() => {
    const milieu = getMilieu(getLocalHour());
    return {
      milieu,
      previousMilieu: milieu,
      blendT: 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });

  useEffect(() => {
    let crossfadeStart: number | null = null;
    let fromMilieu: Milieu = getMilieu(getLocalHour());

    const tick = () => {
      const hour = getLocalHour();
      const nextMilieu = getMilieu(hour);

      setState((prev) => {
        if (nextMilieu !== prev.milieu && crossfadeStart === null) {
          crossfadeStart = performance.now();
          fromMilieu = prev.milieu;
        }

        if (crossfadeStart !== null) {
          const elapsed = performance.now() - crossfadeStart;
          const t = Math.min(1, elapsed / CROSSFADE_DURATION_MS);
          if (t >= 1) {
            crossfadeStart = null;
            return {
              milieu: nextMilieu,
              previousMilieu: nextMilieu,
              blendT: 1,
              timezone: prev.timezone,
            };
          }
          return {
            milieu: nextMilieu,
            previousMilieu: fromMilieu,
            blendT: t,
            timezone: prev.timezone,
          };
        }

        if (prev.milieu !== nextMilieu) {
          return { ...prev, milieu: nextMilieu };
        }
        return prev;
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return state;
}

export function milieuLabel(milieu: Milieu): string {
  switch (milieu) {
    case 'night':
      return 'Night';
    case 'sunrise':
      return 'Sunrise';
    case 'day':
      return 'Day';
  }
}
