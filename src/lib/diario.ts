import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Okio as a journal: what the person tells Okio when closing the day stays on the phone (never sent anywhere
 * except to Okio's own replies), so Okio remembers how the days went and tomorrow is planned from it.
 */
export type Entry = { day: string; text: string; at: number };
export const KEEP_ENTRIES = 90;

export const useDiario = create<{ entries: Entry[] }>()(
  persist(() => ({ entries: [] as Entry[] }), { name: 'okio-journal', storage: createJSONStorage(() => AsyncStorage) }),
);

export function addEntry(day: string, text: string) {
  const v = text.trim();
  if (!v) return;
  const entries = useDiario.getState().entries;
  // One entry per day: what is added later the same evening joins it.
  const same = entries.find((e) => e.day === day);
  const next = same
    ? entries.map((e) => (e.day === day ? { ...e, text: `${e.text}\n${v}`, at: Date.now() } : e))
    : [...entries, { day, text: v, at: Date.now() }];
  useDiario.setState({ entries: next.slice(-KEEP_ENTRIES) });
}

/** The last few entries, short, for Okio's context. */
export function recentEntries(n = 3): string {
  return useDiario
    .getState()
    .entries.slice(-n)
    .map((e) => `${e.day}: ${e.text.slice(0, 300)}`)
    .join(' | ');
}
