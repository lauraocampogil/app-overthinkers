import type { Area } from './perfil';
import { areaIndex } from './perfil';
import type { LivesLog } from './foco';
import type { Task } from './types';

/** Weekly ring per life area: tasks of that area planned this week, and how many are done. */
export function areaRings(tasks: Task[], areas: Area[], week: string[]) {
  const inWeek = tasks.filter((x) => week.includes(x.status === 'hecha' && x.doneOn ? x.doneOn : x.day));
  return areas.slice(0, 3).map((a, i) => {
    const mine = inWeek.filter((x) => areaIndex(x, areas) === i);
    const done = mine.filter((x) => x.status === 'hecha').length;
    return { area: a, done, total: mine.length, pct: mine.length ? done / mine.length : 0 };
  });
}

/** Weekly focus target in minutes (25 min a day, 6 days). */
export const FOCUS_TARGET = 150;

/**
 * Focus Score (0–100) for the week so far:
 * 40 for focus minutes (up to FOCUS_TARGET), 30 for staying in the app during focus (lives kept),
 * 30 for finishing what was planned up to today.
 */
export function focusScore(opts: { tasks: Task[]; week: string[]; today: string; focusLog: Record<string, number>; lives: LivesLog }) {
  const { tasks, week, today, focusLog, lives } = opts;
  const past = week.filter((d) => d <= today);
  const minutes = past.reduce((a, d) => a + (focusLog[d] ?? 0), 0);
  const sessions = past.reduce((a, d) => a + (lives[d]?.s ?? 0), 0);
  const leaves = past.reduce((a, d) => a + (lives[d]?.l ?? 0), 0);
  const planned = tasks.filter((x) => past.includes(x.status === 'hecha' && x.doneOn ? x.doneOn : x.day));
  const done = planned.filter((x) => x.status === 'hecha').length;
  const focusPart = Math.min(1, minutes / FOCUS_TARGET);
  const stayPart = sessions ? Math.max(0, 1 - leaves / (sessions * 3)) : minutes ? 1 : 0;
  const donePart = planned.length ? done / planned.length : 0;
  return {
    score: Math.round(40 * focusPart + 30 * stayPart + 30 * donePart),
    minutes,
    stay: Math.round(stayPart * 100),
    done: Math.round(donePart * 100),
  };
}
