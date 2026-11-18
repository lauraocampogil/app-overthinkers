import { describe, expect, it } from 'vitest';

import { focusScore } from '../puntuacion';
import type { Task } from '../types';

const task = (day: string, done: boolean): Task =>
  ({ id: day + done, title: 'x', kind: 'otro', day, status: done ? 'hecha' : 'pendiente', doneOn: done ? day : undefined, checklist: [], why: [] }) as unknown as Task;

const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

describe('focusScore', () => {
  it('is 0 for an empty week', () => {
    expect(focusScore({ tasks: [], week, today: '2026-11-18', focusLog: {}, lives: {} }).score).toBe(0);
  });

  it('is 100 when everything is done, focus target met and no leaves', () => {
    const r = focusScore({
      tasks: [task('2026-11-16', true), task('2026-11-17', true)],
      week,
      today: '2026-11-18',
      focusLog: { '2026-11-16': 100, '2026-11-17': 60 },
      lives: { '2026-11-16': { s: 2, l: 0 } },
    });
    expect(r.score).toBe(100);
  });

  it('loses points for leaving the app and unfinished tasks; ignores future days', () => {
    const r = focusScore({
      tasks: [task('2026-11-16', true), task('2026-11-17', false), task('2026-11-21', false)],
      week,
      today: '2026-11-18',
      focusLog: { '2026-11-16': 75 },
      lives: { '2026-11-16': { s: 1, l: 3 } },
    });
    // 40*0.5 + 30*0 + 30*0.5
    expect(r.score).toBe(35);
  });
});
