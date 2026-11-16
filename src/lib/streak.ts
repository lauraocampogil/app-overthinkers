import type { Level, Streak } from './types';

export const START_FREEZES: Record<Level, number> = { suave: 3, equilibrado: 2, duro: 1 };
/** Days of streak needed to earn a new freeze. */
export const FREEZE_EVERY: Record<Level, number> = { suave: 7, equilibrado: 7, duro: 14 };
export const MAX_FREEZES = 3;

export const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);

export type StreakOutcome = { streak: Streak; usedFreezes: number; reset: boolean; paused: boolean };

/**
 * Called when the person completes at least one task today.
 * Missed days in between are covered with freezes; without freezes the streak pauses
 * (suave / equilibrado) or resets (duro).
 */
export function countToday(s: Streak, level: Level, today: string): StreakOutcome {
  if (s.lastCountedDate === today) return { streak: s, usedFreezes: 0, reset: false, paused: false };
  let { current, freezes } = s;
  let usedFreezes = 0;
  let reset = false;
  let paused = false;

  if (s.lastCountedDate) {
    const missed = daysBetween(s.lastCountedDate, today) - 1;
    if (missed > 0) {
      usedFreezes = Math.min(missed, freezes);
      freezes -= usedFreezes;
      if (missed > usedFreezes) {
        if (level === 'duro') {
          current = 0;
          reset = true;
        } else {
          paused = true; // keep the number, no punishment
        }
      }
    }
  }

  current += 1;
  if (current % FREEZE_EVERY[level] === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  return { streak: { current, freezes, lastCountedDate: today }, usedFreezes, reset, paused };
}
