import type { Task } from './types';

/**
 * Activities from Apple Health or Strava tick sport tasks by themselves:
 * a run of 30 min marks "Correr 30 min" as done, 10 000 steps mark "Caminar 10.000 pasos".
 * Pure matching here (tested); the sources live in salud.ts and strava.ts.
 */
export type ActivityType = 'run' | 'ride' | 'walk' | 'swim' | 'strength' | 'football' | 'other';
export type Activity = { type: ActivityType; minutes: number; day: string; km?: number; source: 'health' | 'strava' };

const WORDS: Record<Exclude<ActivityType, 'other'>, RegExp> = {
  run: /\b(corr\w*|run\w*|jog\w*|courir|course|lopen|hardlopen|laufen|joggen|correre|corsa)\b/i,
  ride: /\b(bici\w*|bike|cycl\w*|v[ée]lo|fiets\w*|rad\w*|ciclismo|bicicleta)\b/i,
  walk: /\b(camin\w*|pase\w*|walk\w*|march\w*|wandel\w*|spazier\w*|passeggi\w*)\b/i,
  swim: /\b(nad\w*|swim\w*|nag\w*|zwem\w*|schwimm\w*|nuot\w*|piscina|pool)\b/i,
  strength: /\b(gym|gimnas\w*|pesas|fuerza|weights|muscu\w*|kracht\w*|krafttraining|palestra|entreno de fuerza)\b/i,
  football: /\b(f[úu]tbol|football|soccer|foot|voetbal|fu[ßs]ball|calcio|futebol)\b/i,
};

export function activityFor(task: Pick<Task, 'title' | 'sport'>): ActivityType | null {
  for (const [type, re] of Object.entries(WORDS) as [Exclude<ActivityType, 'other'>, RegExp][]) {
    if (re.test(task.title)) return type;
  }
  if (task.sport === 'fuerza') return 'strength';
  if (task.sport === 'cardio') return 'run';
  return null;
}

/** "10.000 pasos", "8k steps" → 10000 / 8000. */
export function stepsGoal(title: string): number | null {
  const m = title.match(/(\d[\d.,]*)\s*(k)?\s*(pasos|steps|pas|stappen|schritte|passi|passos)\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n * (m[2] ? 1000 : 1) : null;
}

/** Ids of pending tasks on `day` that the activities (and the step count) complete. */
export function tasksDoneBy(tasks: Task[], activities: Activity[], day: string, steps = 0): string[] {
  const ids: string[] = [];
  const used = new Set<Activity>();
  for (const task of tasks) {
    if (task.status !== 'pendiente' || task.day !== day) continue;
    const goal = stepsGoal(task.title);
    if (goal) {
      if (steps >= goal) ids.push(task.id);
      continue;
    }
    const want = activityFor(task);
    if (!want) continue;
    const need = Math.max(10, task.minutes ? task.minutes * 0.6 : 10);
    const hit = activities.find((a) => !used.has(a) && a.day === day && a.minutes >= need && (a.type === want || (want === 'strength' && a.type === 'other')));
    if (hit) {
      used.add(hit);
      ids.push(task.id);
    }
  }
  return ids;
}
