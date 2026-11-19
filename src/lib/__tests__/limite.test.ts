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

import { featureLeft } from '../limite';

describe('free features', () => {
  it('3 drafts in total, 5 chat messages a day, week and photo only with Pro', () => {
    const u = { drafts: 2, chatDay: '2026-11-19', chat: 5 };
    expect(featureLeft('draft', u, '2026-11-19', false)).toBe(1);
    expect(featureLeft('chat', u, '2026-11-19', false)).toBe(0);
    expect(featureLeft('chat', u, '2026-11-20', false)).toBe(5);
    expect(featureLeft('week', u, '2026-11-19', false)).toBe(0);
    expect(featureLeft('photo', u, '2026-11-19', true)).toBe(Infinity);
  });
});
