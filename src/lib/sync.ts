import { ensureSession, supabase } from './supabase';
import type { Learned } from './duraciones';
import type { Settings, Streak, Task } from './types';

type Snapshot = {
  tasks: Task[];
  streak: Streak;
  settings: Settings;
  history: Record<string, 'done' | 'freeze'>;
  learned: Learned;
};

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced, fire-and-forget backup to Supabase. The app always works from local state. */
export function syncDay(s: Snapshot) {
  if (!supabase) return;
  if (timer) clearTimeout(timer);
  const snapshot = { tasks: s.tasks, streak: s.streak, settings: s.settings, history: s.history, learned: s.learned };
  timer = setTimeout(() => void push(snapshot), 800);
}

async function push(s: Snapshot) {
  if (!supabase) return;
  try {
    const userId = await ensureSession();
    if (!userId) return;
    const { error } = await supabase.from('profiles').upsert({
      user_id: userId,
      level: s.settings.level,
      free_minutes: s.settings.freeMinutes,
      notify_at: s.settings.notifyAt,
      streak: s.streak,
      tasks: s.tasks,
      history: s.history,
      learned: s.learned,
      prefs: { calendar: s.settings.calendar, dayStart: s.settings.dayStart, dayEnd: s.settings.dayEnd },
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn('[sync]', error.message);
  } catch (e) {
    console.warn('[sync] failed', e);
  }
}

/** Reads this account's copy from the server (used right after sign-in). null if there is none yet. */
export async function pullDay(userId: string): Promise<Partial<Snapshot> | null> {
  if (!supabase) return null;
  try {
    const { data: p, error } = await supabase
      .from('profiles')
      .select('level, free_minutes, notify_at, streak, tasks, history, learned, prefs')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.warn('[sync] pull', error.message);
    if (!p) return null;
    return {
      settings: { level: p.level, freeMinutes: p.free_minutes, notifyAt: p.notify_at, ...(p.prefs ?? {}) } as Settings,
      learned: (p.learned ?? {}) as Learned,
      streak: p.streak as Streak,
      tasks: (p.tasks ?? []) as Task[],
      history: (p.history ?? {}) as Snapshot['history'],
    };
  } catch (e) {
    console.warn('[sync] pull failed', e);
    return null;
  }
}
