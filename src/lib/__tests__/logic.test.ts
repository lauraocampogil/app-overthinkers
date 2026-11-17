import { describe, expect, it } from 'vitest';

import { parseLocal, dueInDaysFrom } from '../parse-local';
import { addDays, schedule } from '../planner';
import { countToday } from '../streak';
import type { Task } from '../types';

// Monday 16 Nov 2026
const MONDAY = new Date('2026-11-16T09:00:00');
const TODAY = '2026-11-16';

const toTasks = (text: string): Task[] =>
  parseLocal(text, MONDAY).tasks.map(({ dueInDays, ...t }, i) => ({
    ...t,
    id: `t${i}`,
    due: dueInDays === null ? null : addDays(TODAY, dueInDays),
    day: TODAY,
    pinned: false,
    postponed: 0,
    status: 'pendiente' as const,
    why: [],
  }));

const base: Omit<Task, 'id' | 'title'> = {
  minutes: null,
  due: null,
  day: TODAY,
  pinned: false,
  energy: 'baja',
  kind: 'otro',
  importance: 2,
  postponed: 0,
  status: 'pendiente',
  why: [],
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

  it('never invents durations, only keeps the ones the person says', () => {
    const { tasks } = parseLocal('ir al gym, 1 hora de estudio, cardio 20 min, media hora de lectura', MONDAY);
    expect(tasks.map((t) => t.minutes)).toEqual([null, 60, 20, 30]);
  });

  it('reads relative deadlines', () => {
    expect(dueInDaysFrom('entregar hoy', MONDAY)).toBe(0);
    expect(dueInDaysFrom('llamar mañana', MONDAY)).toBe(1);
    expect(dueInDaysFrom('el miércoles', MONDAY)).toBe(2);
    expect(dueInDaysFrom('algún día', MONDAY)).toBeNull();
  });
});

describe('schedule', () => {
  const onDay = (list: Task[], day: string) => list.filter((t) => t.day === day).map((t) => t.title);

  it('starts with a quick win, studies before sport and puts strength before cardio', () => {
    const planned = schedule(toTasks('cardio, gym, estudiar mates, contestar a mi jefe 5 min'), { level: 'equilibrado', today: TODAY });
    const titles = onDay(planned, TODAY);
    expect(titles[0]).toBe('Contestar a mi jefe 5 min');
    expect(titles.indexOf('Estudiar mates')).toBeLessThan(titles.indexOf('Gym'));
    expect(titles.indexOf('Gym')).toBeLessThan(titles.indexOf('Cardio'));
    expect(planned[0].why).toContain('why.quick');
  });

  it('orders from most to least important', () => {
    const tasks: Task[] = [
      { ...base, id: 'a', title: 'Puede esperar', importance: 1 },
      { ...base, id: 'b', title: 'Importante', importance: 3 },
      { ...base, id: 'c', title: 'Normal', importance: 2 },
    ];
    const planned = schedule(tasks, { level: 'duro', today: TODAY });
    expect(onDay(planned, TODAY)).toEqual(['Importante', 'Normal', 'Puede esperar']);
    expect(planned[0].why).toContain('why.important');
  });

  it('fills today up to the level, moves the rest to the next days, urgent always today', () => {
    const tasks: Task[] = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `x${i}`, title: `Tarea ${i}`, importance: 1 as const }));
    tasks.push({ ...base, id: 'urgent', title: 'Entregar hoy', due: TODAY });
    const planned = schedule(tasks, { level: 'suave', today: TODAY });
    const today = planned.filter((t) => t.day === TODAY);
    expect(today.some((t) => t.id === 'urgent')).toBe(true);
    expect(today.length).toBe(3);
    expect(planned.filter((t) => t.day === addDays(TODAY, 1)).length).toBe(3);
    expect(planned.filter((t) => t.day === addDays(TODAY, 2)).length).toBe(1);
  });

  it('never plans a task after its deadline and keeps tasks moved by hand', () => {
    const tasks: Task[] = Array.from({ length: 5 }, (_, i) => ({ ...base, id: `x${i}`, title: `Importante ${i}`, importance: 3 as const }));
    tasks.push({ ...base, id: 'due', title: 'Examen mañana', importance: 1, due: addDays(TODAY, 1) });
    tasks.push({ ...base, id: 'pin', title: 'El viernes', importance: 3, day: addDays(TODAY, 4), pinned: true });
    const planned = schedule(tasks, { level: 'suave', today: TODAY });
    const due = planned.find((t) => t.id === 'due');
    expect(due && due.day <= addDays(TODAY, 1)).toBe(true);
    expect(planned.find((t) => t.id === 'pin')?.day).toBe(addDays(TODAY, 4));
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
