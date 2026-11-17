import type { Level, PlannedTask, Task } from './types';

export const MAX_TASKS: Record<Level, number> = { suave: 3, equilibrado: 5, duro: 7 };
export const QUICK_MINUTES = 10;
export const SPLIT_OVER = 60;
export const BLOCK_MINUTES = 45;

type PlanOptions = {
  level: Level;
  freeMinutes?: number;
  tired: boolean;
  /** Ids that must stay in today's list (tasks already planned before adding new ones). */
  keep?: Set<string>;
};
export type PlanResult = { planned: PlannedTask[]; later: Task[] };

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const isUrgent = (t: Task) => t.dueInDays !== null && t.dueInDays <= 2;
const isQuick = (t: Task) => t.minutes !== null && t.minutes <= QUICK_MINUTES;

function score(t: Task): number {
  let s = t.importance * 30;
  if (isUrgent(t)) s += 100 - (t.dueInDays ?? 0) * 10;
  if (t.energy === 'alta') s += 3;
  // Something pushed back again and again deserves to surface.
  s += Math.min(t.postponed, 3) * 4;
  return s;
}

/** Most important first; ties: earliest deadline, then the shortest (a quick win). */
function byImportance(a: Task, b: Task): number {
  return (
    b.importance - a.importance ||
    (a.dueInDays ?? 99) - (b.dueInDays ?? 99) ||
    (a.minutes ?? 999) - (b.minutes ?? 999) ||
    score(b) - score(a)
  );
}

/**
 * Turns a messy list into a short, ordered to-do list for today. Pure and deterministic.
 * Durations are only used when the person gave them; how many tasks go in depends on the level.
 */
export function planDay(input: Task[], opts: PlanOptions): PlanResult {
  const later: Task[] = [];
  const shrunk = new Set<string>();

  // 1. Low energy: make the heavy tasks shorter instead of dropping them (only if we know how long they are).
  // 2. Anything the person said takes over an hour is split; only the first block goes in today.
  const tasks = input.flatMap((t): Task[] => {
    let task = t;
    if (opts.tired && task.energy === 'alta' && task.minutes !== null && task.minutes > 15) {
      task = { ...task, minutes: Math.max(10, round5(task.minutes * 0.7)) };
      shrunk.add(task.id);
    }
    if (task.minutes !== null && task.minutes > SPLIT_OVER) {
      later.push({ ...task, id: `${task.id}-b`, title: `${task.title} (continuación)`, minutes: task.minutes - BLOCK_MINUTES });
      return [{ ...task, title: `${task.title} (parte 1)`, minutes: BLOCK_MINUTES }];
    }
    return [task];
  });

  // 3. Choose: urgent always goes in, the rest by importance up to the level's maximum.
  const maxCount = MAX_TASKS[opts.level];
  const byScore = [...tasks].sort((a, b) => score(b) - score(a));
  const chosen: Task[] = [];
  for (const t of byScore) {
    if (isUrgent(t) || opts.keep?.has(t.id) || chosen.length < maxCount) chosen.push(t);
    else later.push(t);
  }

  // 4. Order from most to least important; then common-sense rules (study before sport,
  //    strength before cardio) adjust within that.
  const ordered = applyDomainRules([...chosen].sort(byImportance));

  const planned = ordered.map((t, i): PlannedTask => ({
    ...t,
    status: 'pendiente',
    why: explain(t, { first: i === 0 && isQuick(t), shrunk: shrunk.has(t.id), ordered }),
  }));
  return { planned, later };
}

/** Study before sport (hard to focus afterwards) and strength before cardio. */
export function applyDomainRules(list: Task[]): Task[] {
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
  if (strength !== -1 && cardio !== -1 && cardio < strength) {
    move(strength, cardio);
  }
  return out;
}

function explain(t: Task, ctx: { first: boolean; shrunk: boolean; ordered: Task[] }): string[] {
  const keys: string[] = [];
  if (t.importance === 3) keys.push('why.important');
  if (ctx.first) keys.push('why.quick');
  if (t.dueInDays === 0) keys.push('why.today');
  else if (t.dueInDays === 1) keys.push('why.tomorrow');
  else if (t.dueInDays === 2) keys.push('why.twoDays');
  if (t.sport === 'fuerza') keys.push('why.strength');
  if (t.sport === 'cardio' && ctx.ordered.some((o) => o.sport === 'fuerza')) keys.push('why.cardio');
  if (t.kind === 'estudio' && ctx.ordered.some((o) => o.kind === 'deporte')) keys.push('why.studyFirst');
  if (t.energy === 'alta' && !ctx.first && t.kind !== 'deporte') keys.push('why.hard');
  if (t.kind === 'casa') keys.push('why.errands');
  if (ctx.shrunk) keys.push('why.shrunk');
  if (t.postponed >= 2) keys.push('why.postponed');
  return keys.length ? keys : ['why.default'];
}
