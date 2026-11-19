import { useMascot } from './auth';
import { bondLevel, useVinculo } from './vinculo';

/**
 * How much of its own colour Okio shows (0 = grey, 1 = all its colours).
 * New people start grey and colour comes with the bond. People who already had their Okio
 * before Okio started grey (accounts from before 19 Nov 2026, or the preview flag) keep their colours.
 */
const GREY_START = Date.parse('2026-11-19T00:00:00Z');

export function useOkioColor(): number {
  const m = useMascot();
  const points = useVinculo((s) => s.points);
  if (m.preview || m.createdAt < GREY_START) return 1;
  return bondLevel(points);
}
