import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { lang, t } from '../i18n';
import { parseBrainDump } from './ai';
import { addDays } from './planner';
import { profileContext } from './perfil';
import { topThree } from './prioridad';
import { focusScore } from './puntuacion';
import { useFoco } from './foco';
import { bond } from './vinculo';
import { track } from './eventos';
import { ensureSession, supabase } from './supabase';
import { goalProgress, todayIso, todayList, useDay, weekStart } from '../store/day';

/** Okio as a mentor: the morning "Today's Read" and a small chat that knows the plan. */
export type ChatMsg = { role: 'user' | 'assistant'; content: string; at: number; /** Tasks added from this message (a dump told to Okio). */ added?: string[] };

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

async function invoke(body: Record<string, unknown>, context = mentorContext()): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  try {
    await ensureSession();
    const { data, error } = await supabase.functions.invoke('mentor', { body: { ...body, lang, context } });
    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.warn('[mentor]', e);
    return null;
  }
}

async function call(body: Record<string, unknown>): Promise<string | null> {
  const data = await invoke(body);
  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  return text || null;
}

/** A dump typed to Okio offline: lines like "tengo que…", lists with commas or line breaks. */
export function looksLikeDump(text: string): boolean {
  const v = text.toLowerCase();
  if (v.includes('?')) return false;
  const verbs = /(tengo que|debo|hay que|necesito|me toca|mañana|hoy|llamar|escribir|enviar|mandar|estudiar|comprar|j'ai|je dois|il faut|demain|appeler|envoyer|i have to|i need to|tomorrow|call|email|ik moet|morgen|ich muss|devo|preciso|amanhã)/;
  const parts = v.split(/[,\n;]|\by\b|\bet\b|\band\b/).filter((x) => x.trim().length > 2).length;
  return verbs.test(v) && parts >= 2;
}

/** Send a message to Okio. When it is a list of things to do, they become tasks and Okio confirms. */
export async function askOkio(text: string): Promise<void> {
  const msg: ChatMsg = { role: 'user', content: text.trim(), at: Date.now() };
  const chat = prune([...useMentor.getState().chat, msg]);
  useMentor.setState({ chat });
  bond('chat');
  track('chat');
  let answer = (await call({ mode: 'chat', messages: chat.map(({ role, content }) => ({ role, content })) })) ?? null;
  const dump = answer ? answer.startsWith('[[DUMP]]') : looksLikeDump(msg.content);
  if (answer) answer = answer.replace(/^\[\[DUMP\]\]\s*/, '');
  let added: string[] | undefined;
  if (dump) {
    const parsed = await parseBrainDump(msg.content);
    if (parsed.tasks.length || parsed.goals?.length) {
      useDay.getState().addParsed({ tasks: parsed.tasks, goals: parsed.goals ?? [] });
      added = parsed.tasks.map((x) => x.title);
      track('dump', { source: 'chat', n: added.length });
      if (!answer) answer = t('mentor.addedLocal');
    }
  }
  useMentor.setState({
    chat: prune([...useMentor.getState().chat, { role: 'assistant' as const, content: answer ?? t('mentor.offline'), at: Date.now(), added }]),
  });
}

/** The first step of a task, written by Okio: an email or a message to review and send. Null when offline. */
export async function draftFor(task: { title: string; notes?: string | null }, channel: 'email' | 'message'): Promise<{ subject: string; body: string } | null> {
  const data = await invoke({ mode: 'draft', task: { title: task.title, notes: task.notes ?? '', channel } }, profileContext(useDay.getState().profile));
  const body = typeof data?.body === 'string' ? data.body.trim() : '';
  if (!body) return null;
  return { subject: typeof data?.subject === 'string' ? data.subject.trim() : '', body };
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


export function clearChat() {
  useMentor.setState({ chat: [] });
}
