import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } }));
vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { placeTasks } from '../agenda-plan';
import { leaveAt, travelMinutes } from '../trayecto';

const ixelles = { lat: 50.8333, lng: 4.3667 };
const grandPlace = { lat: 50.8467, lng: 4.3525 };

describe('travel time', () => {
  it('estimates minutes by mode, rounded up to 5', () => {
    expect(travelMinutes(ixelles, ixelles, 'pie')).toBe(0);
    const walk = travelMinutes(ixelles, grandPlace, 'pie');
    const bus = travelMinutes(ixelles, grandPlace, 'transporte');
    expect(walk).toBeGreaterThanOrEqual(20);
    expect(bus).toBeLessThan(walk);
    expect(walk % 5).toBe(0);
  });
  it('says when to leave, with 5 minutes of margin', () => {
    expect(leaveAt('08:00', 25)).toBe('07:30');
    expect(leaveAt('00:10', 20)).toBe('23:45');
  });
  it('keeps the trip free before a task with a fixed hour', () => {
    const day = new Date('2026-11-24T00:00:00');
    const win = { start: new Date('2026-11-24T07:00:00'), end: new Date('2026-11-24T10:00:00') };
    type T = { id: string; at?: string; min: number; way: number };
    const tasks: T[] = [{ id: 'pilates', at: '08:00', min: 60, way: 30 }, { id: 'mail', min: 30, way: 0 }];
    const { blocks } = placeTasks(tasks, (t) => t.min, win, [], (t) => (t.at ? new Date(`2026-11-24T${t.at}:00`) : null), (t) => t.way);
    const mail = blocks.find((b) => b.type === 'task' && b.task.id === 'mail')!;
    expect(day).toBeTruthy();
    // 07:00–07:30 is free, 07:30–08:00 is the trip, so the 30-min mail fits at 07:00 exactly.
    expect(mail.start.getHours() * 60 + mail.start.getMinutes()).toBe(7 * 60);
    expect(mail.end.getTime()).toBeLessThanOrEqual(new Date('2026-11-24T07:30:00').getTime());
  });
});
