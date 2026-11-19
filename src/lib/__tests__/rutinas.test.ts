import { describe, expect, it, vi } from 'vitest';

vi.mock('../../i18n', () => ({ t: (k: string) => k }));

import { routineDue } from '../rutinas';

const at = (h: number, m = 0) => new Date(2026, 10, 19, h, m);
const routines = {
  manana: { enabled: true, at: '07:00', steps: [] },
  noche: { enabled: true, at: '22:15', steps: [] },
} as never;

describe('routineDue', () => {
  it('shows each routine only around its own time', () => {
    expect(routineDue(routines, at(6, 30))).toBe('manana');
    expect(routineDue(routines, at(8, 59))).toBe('manana');
    expect(routineDue(routines, at(12))).toBeNull();
    expect(routineDue(routines, at(21, 40))).toBe('noche');
    expect(routineDue(routines, at(0, 10))).toBe('noche');
    expect(routineDue(routines, at(0, 27))).toBeNull();
  });
});
