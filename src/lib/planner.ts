import type { Level, PlannedTask, Task } from './types';

export const MAX_TASKS: Record<Level, number> = { suave: 3, equilibrado: 5, duro: 7 };
/** Share of the free time we fill, leaving a margin in case something runs long. */
export const CAPACITY_SHARE = 0.8;
export const QUICK_MINUTES = 10;
export const SPLIT_OVER = 60;
export const BLOCK_MINUTES = 45;

type PlanOptions = { level: Level; freeMinutes: number; tired: boolean };
export type PlanResult = { planned: PlannedTask[]; later: Task[] };

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const isUrgent = (t: Task) => t.dueInDays !== null && t.dueInDays <= 2;
const isQuick = (t: Task) => t.minutes <= QUICK_MINUTES;

function score(t: Task): number {
  let s = 0;
  if (isUrgent(t)) s += 100 - (t.dueInDays ?? 0) * 10;
  if (t.energy === 'alta') s += 5;
  if (t.kind === 'casa') s -= 3;
  // Something pushed back again and again deserves to surface.
  s += Math.min(t.postponed, 3) * 4;
  return s;
}

/** Turns a messy list into a short, ordered plan that fits the day. Pure and deterministic. */
export function planDay(input: Task[], opts: PlanOptions): PlanResult {
  const later: Task[] = [];
  const shrunk = new Set<string>();

  // 1. Low energy: make the heavy tasks shorter instead of dropping them.
  // 2. Anything longer than an hour is split; only the first block goes in today.
  const tasks = input.flatMap((t): Task[] => {
    let task = t;
    if (opts.tired && task.energy === 'alta' && task.minutes > 15) {
      task = { ...task, minutes: Math.max(10, round5(task.minutes * 0.7)) };
      shrunk.add(task.id);
    }
    if (task.minutes > SPLIT_OVER) {
      later.push({ ...task, id: `${task.id}-b`, title: `${task.title} (continuación)`, minutes: task.minutes - BLOCK_MINUTES });
      return [{ ...task, title: `${task.title} (parte 1)`, minutes: BLOCK_MINUTES }];
    }
    return [task];
  });

  // 3. Choose what fits: urgent always goes in, the rest while there is time and room.
  const capacity = Math.floor(opts.freeMinutes * CAPACITY_SHARE);
  const maxCount = MAX_TASKS[opts.level];
  const byScore = [...tasks].sort((a, b) => score(b) - score(a));
  const chosen: Task[] = [];
  let used = 0;
  for (const t of byScore) {
    const fits = used + t.minutes <= capacity && chosen.length < maxCount;
    if (isUrgent(t) || fits) {
      chosen.push(t);
      used += t.minutes;
    } else {
      later.push(t);
    }
  }

  // 4. Order: a quick win first, then the hard things while there is energy, errands last.
  const quick = chosen.filter(isQuick).sort((a, b) => score(b) - score(a))[0];
  const rest = chosen.filter((t) => t !== quick);
  const hard = rest.filter((t) => t.energy === 'alta' && t.kind !== 'casa').sort((a, b) => score(b) - score(a));
  const easy = rest.filter((t) => t.energy !== 'alta' && t.kind !== 'casa').sort((a, b) => score(b) - score(a));
  const errands = rest.filter((t) => t.kind === 'casa');
  let ordered = [...(quick ? [quick] : []), ...hard, ...easy, ...errands];
  ordered = applyDomainRules(ordered);

  const planned = ordered.map((t, i): PlannedTask => ({
    ...t,
    status: 'pendiente',
    why: explain(t, { first: i === 0 && t === quick, shrunk: shrunk.has(t.id), ordered }),
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
