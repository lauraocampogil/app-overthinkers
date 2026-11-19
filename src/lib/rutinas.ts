import { t } from '../i18n';
import type { AreaId } from './perfil';
import type { Routine, RoutineKind } from './types';

/**
 * Morning and night routines. Until the person edits them, GetGo suggests a short, calm default:
 * few steps on purpose, an overthinker's routine should be easy to start.
 */
export function defaultRoutine(kind: RoutineKind, areas: AreaId[] = []): Routine {
  const keys: [string, number][] =
    kind === 'manana'
      ? [['water', 2], ['teeth', 3], ['bed', 3], ...(areas.includes('bajar_peso') ? ([['weigh', 1]] as [string, number][]) : []), ['move', 10], ['top3', 3]]
      : [['tomorrow', 5], ['dump', 5], ['teeth', 3], ['read10', 15], ['screens', 2]];
  return {
    enabled: true,
    at: kind === 'manana' ? '07:30' : '22:00',
    steps: keys.map(([k, minutes]) => ({ id: `${kind}-${k}`, text: t(`routine.step.${k}`), minutes })),
  };
}

export function routineOf(routines: Partial<Record<RoutineKind, Routine>>, kind: RoutineKind): Routine {
  return routines[kind] ?? defaultRoutine(kind);
}

/** Which routine to show now: the morning one until noon, the night one from 18:00. */
/** Which routine fits this moment of the day, regardless of its exact time (used to pick one when opening). */
export function routineNow(date = new Date()): RoutineKind | null {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'manana';
  if (h >= 18 || h < 2) return 'noche';
  return null;
}

/**
 * The routine to show on Hoy: only around its own time, from 45 min before to 2 h after it
 * (a 22:15 night routine shows from 21:30 to 00:15; a 07:00 morning one from 6:15 to 9:00).
 */
export function routineDue(routines: Partial<Record<RoutineKind, Routine>>, date = new Date()): RoutineKind | null {
  const now = date.getHours() * 60 + date.getMinutes();
  for (const kind of ['manana', 'noche'] as RoutineKind[]) {
    const at = routineOf(routines as never, kind).at;
    const m = /^(\d{1,2}):(\d{2})$/.exec(at ?? '');
    if (!m) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const since = (now - start + 1440) % 1440; // minutes after start, wrapping midnight
    if (since <= 120 || since >= 1440 - 45) return kind;
  }
  return null;
}

export const routineMinutes = (r: Routine) => r.steps.reduce((sum, s) => sum + s.minutes, 0);
