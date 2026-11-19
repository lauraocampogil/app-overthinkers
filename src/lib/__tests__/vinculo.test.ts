import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } }));

import { addBond, bondLevel, bondStage, BOND_FULL, CHAT_PER_DAY, EMPTY_BOND, FAMILY_AT } from '../vinculo';

describe('bond with Okio', () => {
  it('starts grey and reaches full colour', () => {
    expect(bondLevel(0)).toBe(0);
    expect(bondLevel(1)).toBeGreaterThan(0);
    expect(bondLevel(BOND_FULL)).toBe(1);
    expect(bondLevel(BOND_FULL * 3)).toBe(1);
  });
  it('counts chat only a few times a day', () => {
    let s = EMPTY_BOND;
    for (let i = 0; i < 20; i++) s = addBond(s, 'chat', undefined, '2026-11-19');
    expect(s.points).toBe(CHAT_PER_DAY);
    s = addBond(s, 'chat', undefined, '2026-11-20');
    expect(s.points).toBe(CHAT_PER_DAY + 1);
  });
  it('picks its colour family from what the person does most, once', () => {
    let s = EMPTY_BOND;
    for (let i = 0; i < FAMILY_AT; i++) s = addBond(s, 'done', 'estudio');
    expect(s.family).toBe(4);
    for (let i = 0; i < 100; i++) s = addBond(s, 'done', 'deporte');
    expect(s.family).toBe(4);
    expect(bondStage(s.points)).toBe(4);
  });
});
