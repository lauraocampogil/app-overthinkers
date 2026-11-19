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

/**
 * The rest of the free plan (product plan): Okio writes 3 drafts to try, 5 chat messages a day;
 * planning the whole week and photo → tasks are Pro. Same rule: only enforced when RevenueCat is live.
 */
export type ProFeature = 'draft' | 'chat' | 'week' | 'photo';
export const FREE_DRAFTS = 3;
export const FREE_CHAT_PER_DAY = 5;

export const useUso = create<{ drafts: number; chatDay: string | null; chat: number }>()(
  persist(() => ({ drafts: 0, chatDay: null as string | null, chat: 0 }), { name: 'okio-use', storage: createJSONStorage(() => AsyncStorage) }),
);

/** Pure rule, tested. */
export function featureLeft(f: ProFeature, u: { drafts: number; chatDay: string | null; chat: number }, day: string, pro: boolean): number {
  if (pro) return Infinity;
  if (f === 'draft') return Math.max(0, FREE_DRAFTS - u.drafts);
  if (f === 'chat') return Math.max(0, FREE_CHAT_PER_DAY - (u.chatDay === day ? u.chat : 0));
  return 0;
}

export async function canUse(f: ProFeature): Promise<boolean> {
  if (!purchasesReady()) return true;
  return featureLeft(f, useUso.getState(), today(), await hasPro()) > 0;
}

export function countUse(f: ProFeature) {
  const u = useUso.getState();
  if (f === 'draft') useUso.setState({ drafts: u.drafts + 1 });
  if (f === 'chat') {
    const day = today();
    useUso.setState({ chatDay: day, chat: u.chatDay === day ? u.chat + 1 : 1 });
  }
}
