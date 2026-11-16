import { describe, expect, it } from 'vitest';

import { parseLocal, dueInDaysFrom } from '../parse-local';
import { planDay } from '../planner';
import { countToday } from '../streak';
import type { Task } from '../types';

// Monday 16 Nov 2026
const MONDAY = new Date('2026-11-16T09:00:00');

const toTasks = (text: string): { tasks: Task[]; tired: boolean } => {
  const { tasks, tired } = parseLocal(text, MONDAY);
  return { tasks: tasks.map((t, i) => ({ ...t, id: `t${i}`, postponed: 0 })), tired };
};

describe('parseLocal', () => {
  it('splits a messy dump and detects tiredness', () => {
    const { tasks, tired } = parseLocal(
      'gym y cardio, examen de mates el jueves, contestar a mi jefe, lavar ropa, estoy bastante cansada hoy',
      MONDAY,
    );
    expect(tired).toBe(true);
    const titles = tasks.map((t) => t.title);
    expect(titles).toEqual(['Gym', 'Cardio', 'Examen de mates el jueves', 'Contestar a mi jefe', 'Lavar ropa']);
    expect(tasks.map((t) => t.sport).slice(0, 2)).toEqual(['fuerza', 'cardio']);
    expect(tasks.find((t) => t.title.startsWith('Examen'))?.dueInDays).toBe(3);
  });

  it('reads relative deadlines', () => {
    expect(dueInDaysFrom('entregar hoy', MONDAY)).toBe(0);
    expect(dueInDaysFrom('llamar mañana', MONDAY)).toBe(1);
    expect(dueInDaysFrom('el miércoles', MONDAY)).toBe(2);
    expect(dueInDaysFrom('algún día', MONDAY)).toBeNull();
  });
});

describe('planDay', () => {
  it('starts with a quick win, studies before sport and puts strength before cardio', () => {
    const { tasks, tired } = toTasks('cardio, gym, estudiar mates, contestar a mi jefe');
    const { planned } = planDay(tasks, { level: 'equilibrado', freeMinutes: 180, tired });
    const titles = planned.map((t) => t.title);
    expect(titles[0]).toBe('Contestar a mi jefe');
    expect(titles.indexOf('Estudiar mates')).toBeLessThan(titles.indexOf('Gym'));
    expect(titles.indexOf('Gym')).toBeLessThan(titles.indexOf('Cardio'));
    expect(planned[0].why).toContain('why.quick');
  });

  it('orders from most to least important', () => {
    const base: Omit<Task, 'id' | 'title' | 'importance'> = { minutes: 20, dueInDays: null, energy: 'baja', kind: 'otro', postponed: 0 };
    const tasks: Task[] = [
      { ...base, id: 'a', title: 'Puede esperar', importance: 1 },
      { ...base, id: 'b', title: 'Importante', importance: 3 },
      { ...base, id: 'c', title: 'Normal', importance: 2 },
    ];
    const { planned } = planDay(tasks, { level: 'duro', freeMinutes: 240, tired: false });
    expect(planned.map((t) => t.title)).toEqual(['Importante', 'Normal', 'Puede esperar']);
    expect(planned[0].why).toContain('why.important');
  });

  it('respects capacity and the per-level maximum, but urgent always goes in', () => {
    const base: Omit<Task, 'id' | 'title'> = { minutes: 30, dueInDays: null, energy: 'baja', kind: 'otro', importance: 1, postponed: 0 };
    const tasks: Task[] = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `x${i}`, title: `Tarea ${i}` }));
    tasks.push({ ...base, id: 'urgent', title: 'Entregar hoy', dueInDays: 0, minutes: 40 });
    const { planned, later } = planDay(tasks, { level: 'suave', freeMinutes: 60, tired: false });
    expect(planned.some((t) => t.id === 'urgent')).toBe(true);
    expect(planned.length).toBeLessThanOrEqual(3);
    expect(planned.length + later.length).toBe(7);
  });

  it('shortens heavy tasks when tired and splits anything over an hour', () => {
    const tasks: Task[] = [
      { id: 'a', title: 'Informe', minutes: 120, dueInDays: null, energy: 'alta', kind: 'trabajo', importance: 2, postponed: 0 },
    ];
    const { planned, later } = planDay(tasks, { level: 'duro', freeMinutes: 240, tired: true });
    expect(planned[0].title).toBe('Informe (parte 1)');
    expect(planned[0].minutes).toBe(45);
    expect(later[0].title).toBe('Informe (continuación)');
  });
});

describe('countToday', () => {
  const s = { current: 5, best: 5, freezes: 1, lastCountedDate: '2026-11-13' };
  it('covers one missed day with a freeze', () => {
    const r = countToday({ ...s, lastCountedDate: '2026-11-14' }, 'equilibrado', '2026-11-16');
    expect(r.usedFreezes).toBe(1);
    expect(r.streak.current).toBe(6);
  });
  it('pauses instead of punishing in equilibrado, resets in duro', () => {
    expect(countToday(s, 'equilibrado', '2026-11-16').streak.current).toBe(6);
    expect(countToday(s, 'duro', '2026-11-16').streak.current).toBe(1);
  });
  it('counts a day only once', () => {
    const once = countToday({ ...s, lastCountedDate: '2026-11-15' }, 'suave', '2026-11-16').streak;
    expect(countToday(once, 'suave', '2026-11-16').streak.current).toBe(once.current);
  });
});
