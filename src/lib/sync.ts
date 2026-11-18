import { ensureSession, supabase } from './supabase';
import type { Learned } from './duraciones';
import type { Goal, Routine, RoutineKind, Settings, Streak, Task } from './types';

type Snapshot = {
  tasks: Task[];
  streak: Streak;
  settings: Settings;
  history: Record<string, 'done' | 'freeze'>;
  learned: Learned;
  goals: Goal[];
  routines: Partial<Record<RoutineKind, Routine>>;
};

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced, fire-and-forget backup to Supabase. The app always works from local state. */
export function syncDay(s: Snapshot) {
  if (!supabase) return;
  if (timer) clearTimeout(timer);
  const snapshot = { tasks: s.tasks, streak: s.streak, settings: s.settings, history: s.history, learned: s.learned, goals: s.goals, routines: s.routines };
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
      // Goals and routines live in prefs (jsonb), so no new column is needed.
      prefs: { calendar: s.settings.calendar, dayStart: s.settings.dayStart, dayEnd: s.settings.dayEnd, goals: s.goals, routines: s.routines },
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
    const { goals, routines, ...prefs } = (p.prefs ?? {}) as Record<string, unknown>;
    return {
      settings: { level: p.level, freeMinutes: p.free_minutes, notifyAt: p.notify_at, ...prefs } as Settings,
      goals: (goals ?? []) as Goal[],
      routines: (routines ?? {}) as Snapshot['routines'],
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
