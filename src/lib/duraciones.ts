import type { Kind, Task } from './types';

/**
 * Personal durations. GetGo never assumes "a workout is 45 min": it learns how long *you* take.
 * - What you say wins ("1 h de gym").
 * - Otherwise your own average for that kind of task, measured from Empezar → Hecho
 *   (or set by you in the task options).
 * - Only with no history yet: a neutral first guess, shown with "~" so it is clear it is a guess.
 */
export type Learned = Record<string, { avg: number; n: number }>;
export type Estimate = { minutes: number; source: 'stated' | 'learned' | 'guess' };

export const FIRST_GUESS: Record<Kind, number> = { trabajo: 45, estudio: 60, deporte: 60, casa: 30, otro: 30 };
const MIN_MEASURE = 2;
const MAX_MEASURE = 6 * 60;

const STOP = new Set([
  'ir', 'al', 'a', 'la', 'el', 'lo', 'de', 'del', 'hacer', 'un', 'una', 'unos', 'los', 'las', 'mi', 'mis', 'para', 'con', 'y',
  'que', 'por', 'en', 'tengo', 'go', 'to', 'the', 'do', 'my', 'le', 'les', 'faire', 'aller', 'naar', 'het', 'zur', 'zum',
]);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

/** "Ir al gym" → "w:gym", "Estudiar mates" → "w:estudiar". Strength / cardio share one key each. */
export function taskKey(t: Pick<Task, 'title' | 'kind' | 'sport'>): string {
  if (t.sport) return `sport:${t.sport}`;
  const word = normalize(t.title)
    .split(/\s+/)
    .find((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  return word ? `w:${word}` : `k:${t.kind}`;
}
const kindKey = (t: Pick<Task, 'kind'>) => `k:${t.kind}`;

export function estimate(t: Pick<Task, 'title' | 'kind' | 'sport' | 'minutes'>, learned: Learned): Estimate {
  if (t.minutes !== null && t.minutes > 0) return { minutes: t.minutes, source: 'stated' };
  const own = learned[taskKey(t)] ?? learned[kindKey(t)];
  if (own && own.n > 0) return { minutes: roundTo5(own.avg), source: 'learned' };
  return { minutes: FIRST_GUESS[t.kind] ?? 30, source: 'guess' };
}

/** Adds one real measurement (or a duration the person set) to their averages. */
export function learn(learned: Learned, t: Pick<Task, 'title' | 'kind' | 'sport'>, minutes: number): Learned {
  if (!Number.isFinite(minutes) || minutes < MIN_MEASURE || minutes > MAX_MEASURE) return learned;
  const next = { ...learned };
  for (const key of new Set([taskKey(t), kindKey(t)])) {
    const prev = next[key];
    // Recent sessions weigh more, so a new routine is picked up within a few days.
    const avg = prev ? prev.avg * 0.6 + minutes * 0.4 : minutes;
    next[key] = { avg, n: (prev?.n ?? 0) + 1 };
  }
  return next;
}

export const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
