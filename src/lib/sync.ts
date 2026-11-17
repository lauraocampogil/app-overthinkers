import { ensureSession, supabase } from './supabase';
import type { PlannedTask, Settings, Streak, Task } from './types';

type Snapshot = {
  planDate: string | null;
  plan: PlannedTask[];
  later: Task[];
  streak: Streak;
  settings: Settings;
  history: Record<string, 'done' | 'freeze'>;
};

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced, fire-and-forget backup to Supabase. The app always works from local state. */
export function syncDay(s: Snapshot) {
  if (!supabase) return;
  if (timer) clearTimeout(timer);
  const snapshot = { ...s };
  timer = setTimeout(() => void push(snapshot), 800);
}

async function push(s: Snapshot) {
  if (!supabase) return;
  try {
    const userId = await ensureSession();
    if (!userId) return;
    const writes = [
      supabase.from('profiles').upsert({
        user_id: userId,
        level: s.settings.level,
        free_minutes: s.settings.freeMinutes,
        notify_at: s.settings.notifyAt,
        streak: s.streak,
        waiting: s.later,
        history: s.history,
        updated_at: new Date().toISOString(),
      }),
    ];
    if (s.planDate) {
      writes.push(
        supabase.from('day_plans').upsert({ user_id: userId, day: s.planDate, tasks: s.plan, updated_at: new Date().toISOString() }),
      );
    }
    const results = await Promise.all(writes);
    results.forEach((r) => r.error && console.warn('[sync]', r.error.message));
  } catch (e) {
    console.warn('[sync] failed', e);
  }
}

/** Reads this account's copy from the server (used right after sign-in). null if there is none yet. */
export async function pullDay(userId: string, today: string): Promise<Partial<Snapshot> | null> {
  if (!supabase) return null;
  try {
    const [profile, day] = await Promise.all([
      supabase.from('profiles').select('level, free_minutes, notify_at, streak, waiting, history').eq('user_id', userId).maybeSingle(),
      supabase.from('day_plans').select('tasks').eq('user_id', userId).eq('day', today).maybeSingle(),
    ]);
    if (profile.error) console.warn('[sync] pull', profile.error.message);
    const p = profile.data;
    if (!p) return null;
    return {
      settings: { level: p.level, freeMinutes: p.free_minutes, notifyAt: p.notify_at } as Settings,
      streak: p.streak as Streak,
      later: (p.waiting ?? []) as Task[],
      history: (p.history ?? {}) as Snapshot['history'],
      ...(day.data ? { plan: day.data.tasks as PlannedTask[], planDate: today } : {}),
    };
  } catch (e) {
    console.warn('[sync] pull failed', e);
    return null;
  }
}
