import { describe, expect, it } from 'vitest';

import { activityFor, stepsGoal, tasksDoneBy } from '../actividad';
import type { Task } from '../types';

const task = (id: string, title: string, minutes: number | null = null): Task =>
  ({ id, title, minutes, day: '2026-11-19', status: 'pendiente', kind: 'otro', checklist: [], why: [] }) as unknown as Task;

describe('activity matching', () => {
  it('recognises sports in several languages', () => {
    expect(activityFor({ title: 'Salir a correr', sport: null })).toBe('run');
    expect(activityFor({ title: 'Go for a run', sport: null })).toBe('run');
    expect(activityFor({ title: 'Entreno de fútbol', sport: null })).toBe('football');
    expect(activityFor({ title: 'Gym piernas', sport: null })).toBe('strength');
    expect(activityFor({ title: 'Llamar a mamá', sport: null })).toBeNull();
  });

  it('reads step goals', () => {
    expect(stepsGoal('Caminar 10.000 pasos')).toBe(10000);
    expect(stepsGoal('8k steps')).toBe(8000);
    expect(stepsGoal('Leer 20 páginas')).toBeNull();
  });

  it('ticks a run only when it is long enough, once per activity', () => {
    const tasks = [task('a', 'Correr 30 min', 30), task('b', 'Correr otra vez', 30), task('c', '10.000 pasos')];
    const run = { type: 'run' as const, minutes: 25, day: '2026-11-19', source: 'strava' as const };
    expect(tasksDoneBy(tasks, [run], '2026-11-19', 12000)).toEqual(['a', 'c']);
    expect(tasksDoneBy(tasks, [{ ...run, minutes: 10 }], '2026-11-19', 500)).toEqual([]);
  });
});
