import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hasPro, purchasesReady } from './monitor';

/**
 * Free plan: one brain dump a day (everything else stays free: the list, focus, closing the day).
 * Only enforced when RevenueCat is configured, so development builds have no limit.
 */
export const FREE_DUMPS_PER_DAY = 1;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useLimite = create<{ day: string | null; n: number }>()(
  persist(() => ({ day: null as string | null, n: 0 }), { name: 'okio-limit', storage: createJSONStorage(() => AsyncStorage) }),
);

/** Pure rule, tested. */
export function dumpsLeft(state: { day: string | null; n: number }, day: string, pro: boolean): number {
  if (pro) return Infinity;
  return Math.max(0, FREE_DUMPS_PER_DAY - (state.day === day ? state.n : 0));
}

export async function canDump(): Promise<boolean> {
  if (!purchasesReady()) return true;
  return dumpsLeft(useLimite.getState(), today(), await hasPro()) > 0;
}

export function countDump() {
  const s = useLimite.getState();
  const day = today();
  useLimite.setState({ day, n: s.day === day ? s.n + 1 : 1 });
}
