import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { lang, t } from '../i18n';
import { addDays } from './planner';
import { profileContext } from './perfil';
import { topThree } from './prioridad';
import { focusScore } from './puntuacion';
import { useFoco } from './foco';
import { ensureSession, supabase } from './supabase';
import { goalProgress, todayIso, todayList, useDay, weekStart } from '../store/day';

/** Okio as a mentor: the morning "Today's Read" and a small chat that knows the plan. */
export type ChatMsg = { role: 'user' | 'assistant'; content: string; at: number };

type MentorState = { readOn: string | null; read: string; readHidden: string | null; chat: ChatMsg[] };

export const useMentor = create<MentorState>()(
  persist(() => ({ readOn: null as string | null, read: '', readHidden: null as string | null, chat: [] as ChatMsg[] }), {
    name: 'okio-mentor',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

/** What Okio knows: today's plan, goals, this week's score and the profile (Spanish: the prompt's language). */
export function mentorContext(): string {
  const st = useDay.getState();
  const day = todayIso();
  const list = todayList(st.tasks);
  const top = topThree(list.filter((x) => x.status === 'pendiente'), day, st.profile.areas);
  const pending = list.filter((x) => x.status === 'pendiente');
  const done = list.filter((x) => x.status === 'hecha');
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i));
  const score = focusScore({ tasks: st.tasks, week, today: day, focusLog: st.focusLog ?? {}, lives: useFoco.getState().lives ?? {} });
  const line = (x: (typeof list)[number]) => `${x.title}${x.at ? ` a las ${x.at}` : ''}${x.minutes ? ` (${x.minutes} min)` : ''}`;
  const goals = st.goals.filter((g) => !g.archived).map((g) => `${g.title} (${Math.round(goalProgress(g, st.tasks).pct * 100)}%)`);
  const hour = new Date().getHours();
  return [
    `Fecha: ${day}, son las ${hour}:00.`,
    pending.length ? `Pendiente hoy (${pending.length}): ${pending.map(line).join('; ')}.` : 'No tiene nada pendiente hoy.',
    top.length ? `Lo más importante: ${top.map((x) => x.title).join(', ')}.` : '',
    done.length ? `Ya hecho hoy: ${done.map((x) => x.title).join(', ')}.` : '',
    goals.length ? `Metas: ${goals.join('; ')}.` : '',
    `Racha: ${st.streak.current} días. Focus Score de la semana: ${score.score}/100.`,
    profileContext(st.profile),
  ]
    .filter(Boolean)
    .join('\n');
}

/** Offline fallback: a plain read from the numbers. */
function localRead(): string {
  const st = useDay.getState();
  const day = todayIso();
  const pending = todayList(st.tasks).filter((x) => x.status === 'pendiente');
  if (!pending.length) return t('read.empty');
  const first = topThree(pending, day, st.profile.areas)[0] ?? pending[0];
  return t('read.local', { n: pending.length, first: first.title });
}

async function call(body: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return null;
  try {
    await ensureSession();
    const { data, error } = await supabase.functions.invoke('mentor', { body: { ...body, lang, context: mentorContext() } });
    if (error) throw error;
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    return text || null;
  } catch (e) {
    console.warn('[mentor]', e);
    return null;
  }
}

/** Today's Read, written once per day (cached). */
export async function loadTodaysRead(force = false): Promise<string> {
  const s = useMentor.getState();
  const day = todayIso();
  if (!force && s.readOn === day && s.read) return s.read;
  const text = (await call({ mode: 'read' })) ?? localRead();
  useMentor.setState({ readOn: day, read: text });
  return text;
}

export function hideTodaysRead() {
  useMentor.setState({ readHidden: todayIso() });
}

/** Conversations are kept on the phone for 30 days (at most 400 messages); older ones are deleted. */
export const KEEP_DAYS = 30;
const prune = (chat: ChatMsg[]) => chat.filter((m) => Date.now() - m.at < KEEP_DAYS * 86_400_000).slice(-400);

export function pruneChat() {
  const s = useMentor.getState();
  const next = prune(s.chat);
  if (next.length !== s.chat.length) useMentor.setState({ chat: next });
}

/** Send a message to Okio; returns the answer (or a gentle offline line). */
export async function askOkio(text: string): Promise<void> {
  const msg: ChatMsg = { role: 'user', content: text.trim(), at: Date.now() };
  const chat = prune([...useMentor.getState().chat, msg]);
  useMentor.setState({ chat });
  const answer = (await call({ mode: 'chat', messages: chat.map(({ role, content }) => ({ role, content })) })) ?? t('mentor.offline');
  useMentor.setState({ chat: prune([...useMentor.getState().chat, { role: 'assistant' as const, content: answer, at: Date.now() }]) });
}

export function clearChat() {
  useMentor.setState({ chat: [] });
}
