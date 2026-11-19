import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Kind } from './types';

/**
 * The bond with Okio. Every mascot is born grey; each time the person empties their head,
 * talks to Okio, finishes something or closes the day, it gains a little colour and character.
 * What they work on most decides its colour family, so nobody ends up with the same Okio.
 */
export type BondEvent = 'dump' | 'chat' | 'done' | 'proof' | 'close';

export const BOND_POINTS: Record<BondEvent, number> = { dump: 3, chat: 1, done: 1, proof: 2, close: 4 };
/** Chat counts a few times a day, so talking a lot does not replace doing. */
export const CHAT_PER_DAY = 5;
/** Points for a fully coloured Okio: about three to four weeks of normal use. */
export const BOND_FULL = 120;
/** Points at which Okio picks its colour family from what the person does most. */
export const FAMILY_AT = 30;

/** Stages, each with its own line in Cuenta. */
export const STAGES = [0, 10, FAMILY_AT, 70, BOND_FULL] as const;

export type BondState = {
  points: number;
  /** Colour family index, fixed once Okio knows the person (null before). */
  family: number | null;
  byKind: Partial<Record<Kind, number>>;
  chatDay: string | null;
  chatToday: number;
};

export const EMPTY_BOND: BondState = { points: 0, family: null, byKind: {}, chatDay: null, chatToday: 0 };

/** Kinds → colour families of the mascot (indexes into Mascota's HUES). */
const KIND_FAMILY: Partial<Record<Kind, number>> = { estudio: 4, trabajo: 5, deporte: 2, casa: 1, otro: 0 };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Pure step, tested: the bond after one event. */
export function addBond(s: BondState, event: BondEvent, kind?: Kind, day = today()): BondState {
  let { chatDay, chatToday } = s;
  if (event === 'chat') {
    if (chatDay !== day) {
      chatDay = day;
      chatToday = 0;
    }
    if (chatToday >= CHAT_PER_DAY) return s;
    chatToday += 1;
  }
  const points = s.points + BOND_POINTS[event];
  const byKind = kind ? { ...s.byKind, [kind]: (s.byKind[kind] ?? 0) + 1 } : s.byKind;
  let family = s.family;
  if (family === null && points >= FAMILY_AT) family = familyFor(byKind);
  return { points, family, byKind, chatDay, chatToday };
}

/** The family of what the person does most; the seed decides when nothing stands out. */
export function familyFor(byKind: Partial<Record<Kind, number>>): number | null {
  const top = Object.entries(byKind).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  if (!top) return null;
  return KIND_FAMILY[top[0] as Kind] ?? null;
}

/** 0 = grey, 1 = all its colours. Eased so the first days already show a hint. */
export function bondLevel(points: number): number {
  const p = Math.max(0, Math.min(1, points / BOND_FULL));
  return p === 0 ? 0 : 0.08 + 0.92 * Math.sqrt(p);
}

export function bondStage(points: number): number {
  let i = 0;
  STAGES.forEach((min, k) => {
    if (points >= min) i = k;
  });
  return i;
}

export const useVinculo = create<BondState & { seeded: boolean }>()(
  persist(() => ({ ...EMPTY_BOND, seeded: false as boolean }), { name: 'okio-bond', storage: createJSONStorage(() => AsyncStorage) }),
);

export function bond(event: BondEvent, kind?: Kind) {
  const s = useVinculo.getState();
  const next = addBond(s, event, kind);
  if (next !== s) useVinculo.setState(next);
}

/** People who used the app before the bond existed start with what they already did. */
export function seedBond(done: { kind?: Kind | null }[], closedDays: number) {
  const s = useVinculo.getState();
  if (s.seeded) return;
  let next: BondState = s;
  for (const x of done.slice(-200)) next = addBond(next, 'done', x.kind ?? undefined);
  next = { ...next, points: next.points + closedDays * BOND_POINTS.close };
  if (next.family === null && next.points >= FAMILY_AT) next = { ...next, family: familyFor(next.byKind) };
  useVinculo.setState({ ...next, seeded: true });
}
