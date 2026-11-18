import type { AreaId } from './perfil';
import type { Goal, RoutineKind } from './types';

/**
 * Challenges: small extra habits GetGo proposes for a goal ("20 abdominales antes de dormir").
 * The person accepts or not. Accepted ones join a routine and grow a little each week they keep them.
 */
export type RetoId = 'abs' | 'pushups' | 'squats' | 'plank' | 'walk' | 'water' | 'nosugar' | 'pomodoro' | 'review' | 'noscreens' | 'breathe' | 'journal' | 'deepwork';

type Def = { routine: RoutineKind; start: number; step: number; max: number; minutes: number; areas: AreaId[]; words: string[] };

export const RETOS: Record<RetoId, Def> = {
  abs: { routine: 'noche', start: 20, step: 5, max: 60, minutes: 3, areas: ['bajar_peso', 'musculo', 'gimnasio'], words: ['peso', 'kg', 'kilos', 'abdomen', 'weight'] },
  pushups: { routine: 'noche', start: 10, step: 5, max: 50, minutes: 3, areas: ['musculo', 'gimnasio', 'bajar_peso'], words: ['músculo', 'musculo', 'fuerza', 'muscle'] },
  squats: { routine: 'manana', start: 20, step: 5, max: 60, minutes: 3, areas: ['musculo', 'bajar_peso', 'deporte'], words: ['piernas', 'glúteos', 'gluteos'] },
  plank: { routine: 'noche', start: 30, step: 15, max: 180, minutes: 3, areas: ['musculo', 'gimnasio', 'deporte'], words: ['core', 'abdomen'] },
  walk: { routine: 'manana', start: 15, step: 5, max: 45, minutes: 20, areas: ['bajar_peso', 'salud_mental', 'deporte'], words: ['peso', 'caminar', 'pasos'] },
  water: { routine: 'manana', start: 2, step: 0, max: 2, minutes: 1, areas: ['comer_bien', 'bajar_peso'], words: ['agua', 'comer'] },
  nosugar: { routine: 'noche', start: 1, step: 0, max: 1, minutes: 1, areas: ['comer_bien', 'bajar_peso'], words: ['azúcar', 'azucar', 'dulces', 'peso'] },
  pomodoro: { routine: 'manana', start: 2, step: 1, max: 4, minutes: 50, areas: ['estudios', 'trabajo', 'proyecto'], words: ['examen', 'estudiar', 'aprobar'] },
  review: { routine: 'noche', start: 10, step: 5, max: 20, minutes: 10, areas: ['estudios'], words: ['examen', 'aprobar'] },
  noscreens: { routine: 'noche', start: 30, step: 15, max: 60, minutes: 1, areas: ['dormir', 'salud_mental'], words: ['dormir', 'sueño'] },
  breathe: { routine: 'manana', start: 3, step: 1, max: 10, minutes: 5, areas: ['salud_mental'], words: ['estrés', 'estres', 'ansiedad', 'calma'] },
  journal: { routine: 'noche', start: 3, step: 0, max: 3, minutes: 3, areas: ['salud_mental', 'dormir'], words: ['agradecer', 'diario'] },
  deepwork: { routine: 'manana', start: 45, step: 15, max: 90, minutes: 45, areas: ['trabajo', 'proyecto', 'contenido'], words: ['lanzar', 'proyecto', 'app'] },
};

export type Reto = {
  id: RetoId;
  status: 'offered' | 'accepted' | 'declined';
  /** Current amount (20 abdominales, 30 s de plancha…). */
  n: number;
  goalId: string | null;
  since: string;
};

/** The next challenge worth proposing, based on the person's areas and goals; null if nothing fits right now. */
export function nextReto(areas: AreaId[], goals: Goal[], have: Reto[], today: string): { id: RetoId; goalId: string | null } | null {
  const recentNo = (id: RetoId) => have.some((r) => r.id === id && (r.status !== 'declined' || daysSince(r.since, today) < 14));
  const live = goals.filter((g) => !g.archived);
  let best: { id: RetoId; goalId: string | null; score: number } | null = null;
  for (const id of Object.keys(RETOS) as RetoId[]) {
    if (recentNo(id)) continue;
    const def = RETOS[id];
    const goal = live.find((g) => def.words.some((w) => g.title.toLowerCase().includes(w)));
    const areaHit = areas.findIndex((a) => def.areas.includes(a));
    const score = (goal ? 10 : 0) + (areaHit >= 0 ? 6 - areaHit * 2 : 0);
    if (score > 0 && (!best || score > best.score)) best = { id, goalId: goal?.id ?? null, score };
  }
  return best ? { id: best.id, goalId: best.goalId } : null;
}

const daysSince = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);

export const retoStepId = (id: RetoId) => `reto-${id}`;

/** Goals measured on a scale (weight): GetGo asks the number at the start and every Monday. */
export const isWeightGoal = (g: Goal) => /\b(kg|kilo|kilos|peso|pesar|weight|lbs|poids|gewicht|abnehmen|perdre|perder|bajar)\b/i.test(g.title);

/** The goal that needs its weekly check-in today (first time, or Monday with nothing this week). */
export function checkinDue(goals: Goal[], today: string): Goal | null {
  const monday = new Date(`${today}T12:00:00`).getDay() === 1;
  for (const g of goals.filter((x) => !x.archived)) {
    const list = g.checkins ?? [];
    const last = list[list.length - 1]?.date;
    if (!last && isWeightGoal(g)) return g;
    if (monday && (!last || last < today) && (isWeightGoal(g) || list.length > 0)) return g;
  }
  return null;
}
