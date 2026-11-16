import { ensureSession, supabase } from './supabase';
import type { PlannedTask, Settings, Streak, Task } from './types';

type Snapshot = { planDate: string | null; plan: PlannedTask[]; later: Task[]; streak: Streak; settings: Settings };

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
