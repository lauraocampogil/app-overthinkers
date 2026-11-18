import { t } from '../i18n';
import type { Routine, RoutineKind } from './types';

/**
 * Morning and night routines. Until the person edits them, GetGo suggests a short, calm default:
 * few steps on purpose, an overthinker's routine should be easy to start.
 */
export function defaultRoutine(kind: RoutineKind): Routine {
  const keys =
    kind === 'manana'
      ? ([['water', 2], ['bed', 3], ['move', 10], ['top3', 3]] as const)
      : ([['tomorrow', 5], ['dump', 5], ['screens', 2], ['read', 15]] as const);
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
export function routineNow(date = new Date()): RoutineKind | null {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'manana';
  if (h >= 18 || h < 2) return 'noche';
  return null;
}

export const routineMinutes = (r: Routine) => r.steps.reduce((sum, s) => sum + s.minutes, 0);
