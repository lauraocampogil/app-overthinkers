import { isoDay } from './streak';
import type { Level, Task } from './types';

/** How many tasks GetGo puts on one day, per level. Urgent tasks always go in on top. */
export const MAX_TASKS: Record<Level, number> = { suave: 3, equilibrado: 5, duro: 7 };
export const QUICK_MINUTES = 10;
const HORIZON_DAYS = 60;

const DAY = 86_400_000;
export const addDays = (iso: string, n: number) => isoDay(new Date(Date.parse(`${iso}T12:00:00`) + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / DAY);

type Opts = { level: Level; today: string };

const daysLeft = (t: Task, today: string) => (t.due ? daysBetween(today, t.due) : null);
const isQuick = (t: Task) => t.minutes !== null && t.minutes <= QUICK_MINUTES;

function score(t: Task, today: string): number {
  const left = daysLeft(t, today);
  let s = t.importance * 30;
  if (left !== null && left <= 2) s += 100 - Math.max(left, 0) * 10;
  if (t.energy === 'alta') s += 3;
  // Something pushed back again and again deserves to surface.
  s += Math.min(t.postponed, 3) * 4;
  return s;
}

/** Most important first; ties: earliest deadline, then the shortest (a quick win). */
function byImportance(today: string) {
  return (a: Task, b: Task) =>
    b.importance - a.importance ||
    (daysLeft(a, today) ?? 99) - (daysLeft(b, today) ?? 99) ||
    (a.minutes ?? 999) - (b.minutes ?? 999) ||
    score(b, today) - score(a, today);
}

/**
 * The heart of GetGo. Takes every task and decides which day each one goes on:
 * - urgent or overdue → today, always;
 * - a deadline → no later than that day;
 * - the rest by importance, filling each day up to the level's maximum, then the next day…
 * Tasks the person moved by hand keep their day. Done tasks are left as they are.
 * Within a day: most important first, then common sense (study before sport, strength before cardio).
 * Pure and deterministic.
 */
export function schedule(all: Task[], opts: Opts): Task[] {
  const { today, level } = opts;
  const cap = MAX_TASKS[level];
  const done = all.filter((t) => t.status === 'hecha');
  const open = all.filter((t) => t.status === 'pendiente');
  const count = new Map<string, number>();
  const placed = new Map<string, string>();
  const bump = (day: string) => count.set(day, (count.get(day) ?? 0) + 1);

  for (const t of open) {
    if (t.pinned) {
      const day = t.day < today ? today : t.day;
      placed.set(t.id, day);
      bump(day);
    }
  }

  const free = open.filter((t) => !t.pinned).sort((a, b) => score(b, today) - score(a, today));
  for (const t of free) {
    const left = daysLeft(t, today);
    let day = today;
    if (left !== null && left <= 0) {
      day = today; // overdue or due today
    } else {
      for (let d = 0; d <= HORIZON_DAYS; d++) {
        if (left !== null && d >= left) {
          day = addDays(today, left); // never later than the deadline, even if that day is full
          break;
        }
        const candidate = addDays(today, d);
        if ((count.get(candidate) ?? 0) < cap) {
          day = candidate;
          break;
        }
      }
    }
    placed.set(t.id, day);
    bump(day);
  }

  // Group by day, order inside each day, explain today's.
  const byDay = new Map<string, Task[]>();
  for (const t of open) {
    const day = placed.get(t.id) ?? today;
    byDay.set(day, [...(byDay.get(day) ?? []), { ...t, day }]);
  }
  const days = [...byDay.keys()].sort();
  const ordered: Task[] = [];
  for (const day of days) {
    const list = applyDomainRules([...(byDay.get(day) ?? [])].sort(byImportance(today)));
    list.forEach((t, i) =>
      ordered.push({ ...t, why: explain(t, { today, first: day === today && i === 0 && isQuick(t), list }) }),
    );
  }
  return [...ordered, ...done];
}

/** Study before sport (hard to focus afterwards) and strength before cardio. */
export function applyDomainRules<T extends Task>(list: T[]): T[] {
  const out = [...list];
  const move = (from: number, to: number) => {
    const [item] = out.splice(from, 1);
    out.splice(to, 0, item);
  };
  const firstSport = () => out.findIndex((t) => t.kind === 'deporte');
  out.forEach((t, i) => {
    if (t.kind === 'estudio') {
      const s = firstSport();
      if (s !== -1 && s < i) move(i, s);
    }
  });
  const strength = out.findIndex((t) => t.sport === 'fuerza');
  const cardio = out.findIndex((t) => t.sport === 'cardio');
  if (strength !== -1 && cardio !== -1 && cardio < strength) move(strength, cardio);
  return out;
}

function explain(t: Task, ctx: { today: string; first: boolean; list: Task[] }): string[] {
  const keys: string[] = [];
  const left = daysLeft(t, ctx.today);
  if (t.importance === 3) keys.push('why.important');
  if (ctx.first) keys.push('why.quick');
  if (left !== null && left <= 0) keys.push('why.today');
  else if (left === 1) keys.push('why.tomorrow');
  else if (left === 2) keys.push('why.twoDays');
  if (t.sport === 'fuerza') keys.push('why.strength');
  if (t.sport === 'cardio' && ctx.list.some((o) => o.sport === 'fuerza')) keys.push('why.cardio');
  if (t.kind === 'estudio' && ctx.list.some((o) => o.kind === 'deporte')) keys.push('why.studyFirst');
  if (t.energy === 'alta' && !ctx.first && t.kind !== 'deporte') keys.push('why.hard');
  if (t.kind === 'casa') keys.push('why.errands');
  if (t.postponed >= 2) keys.push('why.postponed');
  return keys.length ? keys : ['why.default'];
}
