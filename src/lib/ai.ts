import { File } from 'expo-file-system';

import { useDay } from '../store/day';
import { parseLocal } from './parse-local';
import { profileContext } from './perfil';
import { lang } from '../i18n';
import { isoDay } from './streak';
import { ensureSession, supabase } from './supabase';
import type { RawGoal, Energy, Kind, ParseResult, RawTask, TaskQuestion } from './types';

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
  const checklist = Array.isArray(r.checklist)
    ? r.checklist.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 30)
    : [];
  const where = typeof r.where === 'string' && r.where.trim() ? r.where.trim().slice(0, 80) : null;
  const at = typeof r.at === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(r.at.trim()) ? r.at.trim().padStart(5, '0') : null;
  const goal = typeof r.goal === 'string' && r.goal.trim() ? r.goal.trim() : null;
  const proof = typeof r.proof === 'string' && r.proof.trim() ? r.proof.trim().slice(0, 60) : null;
  const ask: TaskQuestion[] = Array.isArray(r.ask)
    ? (r.ask as unknown[])
        .map((a) => a as Partial<TaskQuestion>)
        .filter((a) => typeof a?.q === 'string' && a.q.trim() && (a.kind === 'minutes' || a.kind === 'text' || a.kind === 'deadline'))
        .filter((a) => !(a.kind === 'minutes' && minutes !== null) && !(a.kind === 'deadline' && !Number.isNaN(due) && due !== null))
        .slice(0, 2)
        .map((a) => ({ q: String(a.q).slice(0, 120), kind: a.kind as TaskQuestion['kind'], template: typeof a.template === 'string' && a.template.includes('{}') ? a.template.slice(0, 120) : undefined }))
    : [];
  const askMinutes = minutes === null && !ask.some((a) => a.kind === 'minutes') && (r.askMinutes === true || kind === 'deporte' || kind === 'estudio');
  return { title, minutes, dueInDays: Number.isNaN(due) ? null : due, energy, kind, sport, importance, checklist, where, at, goal, proof, askMinutes, ask };
}

function sanitizeGoal(raw: unknown): RawGoal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title) return null;
  const type: RawGoal['type'] = r.type === 'semanal' || r.type === 'largo' ? r.type : 'pronto';
  const due = r.dueInDays === null || r.dueInDays === undefined ? null : Math.max(0, Math.round(Number(r.dueInDays)));
  const per = Math.round(Number(r.perWeek));
  const steps = (Array.isArray(r.steps) ? r.steps : []).map(sanitize).filter(Boolean).slice(0, 8) as RawTask[];
  const tpl = r.template && typeof r.template === 'object' ? sanitize({ title, ...(r.template as object) }) : null;
  return {
    title,
    type,
    dueInDays: due === null || Number.isNaN(due) ? null : due,
    perWeek: type === 'semanal' && per > 0 ? Math.min(14, per) : null,
    steps,
    template: tpl ? { title: tpl.title, minutes: tpl.minutes, where: tpl.where, at: tpl.at, kind: tpl.kind, sport: tpl.sport, checklist: tpl.checklist, energy: tpl.energy } : undefined,
  };
}

/** Brain dump -> tasks. Uses the plan-day Edge Function (Groq or Claude) and falls back to the local parser. */
export async function parseBrainDump(text: string): Promise<ParseResult & { source: 'ia' | 'local' }> {
  if (supabase) {
    try {
      await ensureSession();
      const now = new Date();
      const { data, error } = await supabase.functions.invoke('plan-day', {
        body: { text, today: isoDay(now), weekday: now.getDay(), lang, profile: profileContext(useDay.getState().profile) },
      });
      if (error) throw error;
      const tasks = (Array.isArray(data?.tasks) ? data.tasks : []).map(sanitize).filter(Boolean) as RawTask[];
      const goals = (Array.isArray(data?.goals) ? data.goals : []).map(sanitizeGoal).filter(Boolean) as RawGoal[];
      if (tasks.length || goals.length) return { tasks, goals, tired: Boolean(data?.tired), source: 'ia' };
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

/** Last transcription error, shown small on the "no te he entendido" screen so problems can be reported. */
export let lastVoiceError = '';

/**
 * Voice note -> text via the transcribe Edge Function. Returns null if it is not available.
 * The audio goes as base64 JSON: React Native's multipart uploads were unreliable through functions.invoke.
 */
export async function transcribe(uri: string): Promise<string | null> {
  lastVoiceError = '';
  if (!supabase) {
    lastVoiceError = 'no-server';
    return null;
  }
  try {
    await ensureSession();
    const audio = await new File(uri).base64();
    if (!audio) {
      lastVoiceError = 'empty-audio';
      return null;
    }
    const name = uri.split('/').pop() || 'nota.m4a';
    const { data, error } = await supabase.functions.invoke('transcribe', {
      body: { audio, name, lang },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const detail = ctx && typeof ctx.text === 'function' ? await ctx.text().catch(() => '') : '';
      lastVoiceError = `${ctx?.status ?? ''} ${detail || error.message}`.trim().slice(0, 160);
      console.warn('[ai] transcribe failed', lastVoiceError);
      return null;
    }
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) lastVoiceError = 'no-speech';
    return text || null;
  } catch (e) {
    lastVoiceError = String(e).slice(0, 160);
    console.warn('[ai] transcribe failed', e);
    return null;
  }
}

export type ProofCheck = { ok: boolean; reason: string; offline?: boolean; failed?: boolean };

/**
 * Photo proof: the AI checks that the picture really shows the task done.
 * If the check can't run, the photo is NOT accepted: the person can try again (hecho es hecho).
 */
export async function verifyProof(base64: string, task: string, hint: string | null | undefined): Promise<ProofCheck> {
  if (!supabase) return { ok: false, reason: '', failed: true };
  try {
    await ensureSession();
    const { data, error } = await supabase.functions.invoke('verify-proof', {
      body: { image: base64, mediaType: 'image/jpeg', task, hint: hint ?? null, lang },
    });
    if (error) throw error;
    if (typeof data?.ok !== 'boolean') return { ok: false, reason: '', failed: true };
    return { ok: data.ok, reason: typeof data?.reason === 'string' ? data.reason : '' };
  } catch (e) {
    const ctx = (e as { context?: Response }).context;
    const detail = ctx && typeof ctx.text === 'function' ? await ctx.text().catch(() => '') : '';
    console.warn('[ai] proof check failed', e, detail);
    return { ok: false, reason: '', failed: true };
  }
}

export type WeekPlan = { tasks: RawTask[]; goals: RawGoal[]; wake: string | null; advice: string };

/** Last reason the week plan failed, shown on the screen so the person (and we) can see what happened. */
export let lastWeekError = '';

/** "Planificar mi semana": the AI spreads what the person said over the 7 days, with times, and gives advice. */
export async function planWeek(text: string, attempt = 0): Promise<WeekPlan | null> {
  if (!supabase) {
    lastWeekError = 'no_supabase';
    return null;
  }
  try {
    await ensureSession();
    const now = new Date();
    const { data, error } = await supabase.functions.invoke('plan-day', {
      body: { text, today: isoDay(now), weekday: now.getDay(), lang, profile: profileContext(useDay.getState().profile), mode: 'week' },
    });
    if (error) throw error;
    const wake = typeof data?.wake === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(data.wake) ? data.wake.padStart(5, '0') : null;
    const tasks = ((Array.isArray(data?.tasks) ? data.tasks : []).map(sanitize).filter(Boolean) as RawTask[]).map((t) => ({ ...t, dueInDays: Math.max(0, Math.min(6, t.dueInDays ?? 0)) }));
    if (!tasks.length && attempt === 0) return planWeek(text, 1);
    lastWeekError = tasks.length ? '' : 'empty';
    return {
      tasks,
      goals: (Array.isArray(data?.goals) ? data.goals : []).map(sanitizeGoal).filter(Boolean) as RawGoal[],
      wake,
      advice: typeof data?.advice === 'string' ? data.advice.slice(0, 400) : '',
    };
  } catch (e) {
    const ctx = (e as { context?: Response }).context;
    const detail = ctx && typeof ctx.text === 'function' ? await ctx.text().catch(() => '') : String(e);
    console.warn('[ai] week plan failed', e, detail);
    lastWeekError = detail.slice(0, 200);
    // One quiet retry: the free AI quota sometimes refuses a request for a few seconds.
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      return planWeek(text, 1);
    }
    return null;
  }
}
