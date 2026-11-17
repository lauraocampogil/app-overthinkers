import { parseLocal } from './parse-local';
import { lang } from '../i18n';
import { isoDay } from './streak';
import { ensureSession, supabase } from './supabase';
import type { Energy, Kind, ParseResult, RawTask } from './types';

const KINDS: Kind[] = ['trabajo', 'estudio', 'deporte', 'casa', 'otro'];

function sanitize(raw: unknown): RawTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title) return null;
  // Only a duration the person actually gave; anything else stays unknown.
  const n = Math.round(Number(r.minutes));
  const minutes = r.minutes === null || r.minutes === undefined || !Number.isFinite(n) || n <= 0 ? null : Math.min(480, Math.max(1, n));
  const due = r.dueInDays === null || r.dueInDays === undefined ? null : Math.max(0, Math.round(Number(r.dueInDays)));
  const energy: Energy = r.energy === 'alta' ? 'alta' : 'baja';
  const kind: Kind = KINDS.includes(r.kind as Kind) ? (r.kind as Kind) : 'otro';
  const sport = r.sport === 'fuerza' || r.sport === 'cardio' ? r.sport : null;
  const imp = Math.round(Number(r.importance));
  const importance: 1 | 2 | 3 = imp >= 3 ? 3 : imp <= 1 ? 1 : 2;
  return { title, minutes, dueInDays: Number.isNaN(due) ? null : due, energy, kind, sport, importance };
}

/** Brain dump -> tasks. Uses the plan-day Edge Function (Groq or Claude) and falls back to the local parser. */
export async function parseBrainDump(text: string): Promise<ParseResult & { source: 'ia' | 'local' }> {
  if (supabase) {
    try {
      await ensureSession();
      const now = new Date();
      const { data, error } = await supabase.functions.invoke('plan-day', {
        body: { text, today: isoDay(now), weekday: now.getDay(), lang },
      });
      if (error) throw error;
      const tasks = (Array.isArray(data?.tasks) ? data.tasks : []).map(sanitize).filter(Boolean) as RawTask[];
      if (tasks.length) return { tasks, tired: Boolean(data?.tired), source: 'ia' };
    } catch (e) {
      console.warn('[ai] plan-day failed, using local parser', e);
    }
  }
  return { ...parseLocal(text), source: 'local' };
}

/** Screenshot of messages/emails -> tasks, read by the AI (vision). null when unavailable. */
export async function tasksFromImage(base64: string, mediaType = 'image/jpeg'): Promise<RawTask[] | null> {
  if (!supabase) return null;
  try {
    await ensureSession();
    const now = new Date();
    const { data, error } = await supabase.functions.invoke('plan-day', {
      body: { image: base64, mediaType, today: isoDay(now), weekday: now.getDay(), lang },
    });
    if (error) throw error;
    return ((Array.isArray(data?.tasks) ? data.tasks : []).map(sanitize).filter(Boolean) as RawTask[]);
  } catch (e) {
    const ctx = (e as { context?: Response }).context;
    const detail = ctx && typeof ctx.text === 'function' ? await ctx.text().catch(() => '') : '';
    console.warn('[ai] image failed', e, detail);
    return null;
  }
}

/** Voice note -> text via the transcribe Edge Function. Returns null if it is not available. */
export async function transcribe(uri: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    await ensureSession();
    const form = new FormData();
    // React Native's FormData accepts { uri, name, type } for files.
    form.append('file', { uri, name: 'nota.m4a', type: 'audio/m4a' } as unknown as Blob);
    form.append('lang', lang);
    const { data, error } = await supabase.functions.invoke('transcribe', { body: form });
    if (error) throw error;
    return typeof data?.text === 'string' && data.text.trim() ? data.text.trim() : null;
  } catch (e) {
    console.warn('[ai] transcribe failed', e);
    return null;
  }
}
