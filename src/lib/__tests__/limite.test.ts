import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } }));
vi.mock('../monitor', () => ({ hasPro: async () => false, purchasesReady: () => false }));

import { dumpsLeft } from '../limite';

describe('free plan', () => {
  it('gives one dump a day, unlimited with Pro', () => {
    expect(dumpsLeft({ day: null, n: 0 }, '2026-11-19', false)).toBe(1);
    expect(dumpsLeft({ day: '2026-11-19', n: 1 }, '2026-11-19', false)).toBe(0);
    expect(dumpsLeft({ day: '2026-11-18', n: 3 }, '2026-11-19', false)).toBe(1);
    expect(dumpsLeft({ day: '2026-11-19', n: 5 }, '2026-11-19', true)).toBe(Infinity);
  });
});
