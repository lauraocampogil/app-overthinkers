import { ensureSession, supabase } from './supabase';

/**
 * Product events, to know if Okio works: day-7 retention, plans kept, top 3 done, days closed, paywall.
 * Only an event name and numbers, never what the person wrote. Fire-and-forget: never blocks the app.
 */
export type EventName = 'open' | 'dump' | 'plan' | 'top_done' | 'close_day' | 'proof' | 'draft' | 'chat' | 'paywall' | 'purchase';

let lastOpen: string | null = null;

export function track(name: EventName, props: Record<string, number | string | boolean> = {}) {
  if (!supabase) return;
  if (name === 'open') {
    const day = new Date().toDateString();
    if (lastOpen === day) return;
    lastOpen = day;
  }
  void (async () => {
    try {
      const userId = await ensureSession();
      if (!userId) return;
      await supabase!.from('events').insert({ user_id: userId, name, props });
    } catch {
      // offline: an event lost is fine
    }
  })();
}
