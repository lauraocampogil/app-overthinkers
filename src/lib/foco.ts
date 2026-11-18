import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { t } from '../i18n';
import { blockForFocus, unblockAll } from './bloqueo';
import type { FocoProps } from '../widgets/FocoActividad';

/**
 * A focus session: one task, a countdown, nothing else on screen.
 * The timer is also on the Lock Screen / Dynamic Island as a Live Activity (store / paid builds only;
 * with the free signing every Live Activity call is a silent no-op and the in-app timer still works).
 */
type Session = {
  taskId: string;
  title: string;
  startedAt: number;
  /** Planned length in minutes (the task's estimate). */
  minutes: number;
  pausedAt: number | null;
  /** Total ms spent paused so far. */
  pausedMs: number;
  color: string;
  /** How many times the person left the app during this session. Like a plant: each leave hurts the mascot. */
  leaves?: number;
  /** When the app went to the background (to ignore quick glances). */
  awayAt?: number | null;
  colorSoft: string;
};

/** Per day: focus sessions run and times the person left the app during them (for the Focus Score). */
export type LivesLog = Record<string, { s: number; l: number }>;
type FocoState = { session: Session | null; lives: LivesLog };

export const useFoco = create<FocoState>()(
  persist(() => ({ session: null as Session | null, lives: {} as LivesLog }), {
    name: 'getgo-foco',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

type Activity = { update: (p: FocoProps) => Promise<void>; end: (policy?: 'default' | 'immediate') => Promise<void> };
type Factory = { start: (p: FocoProps, url?: string) => Activity; getInstances: () => Activity[] };

let factory: Factory | null = null;
if (requireOptionalNativeModule('ExpoWidgets')) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = require('../widgets/FocoActividad').default as Factory;
  } catch (e) {
    console.warn('[foco] live activity not available', e);
  }
}

const current = (): Activity | null => {
  try {
    return factory?.getInstances()[0] ?? null;
  } catch {
    return null;
  }
};

/** Elapsed focus time in ms (pauses not counted). */
export function elapsedMs(s: Session, now = Date.now()) {
  const until = s.pausedAt ?? now;
  return Math.max(0, until - s.startedAt - s.pausedMs);
}

/** When the countdown reaches zero, shifted by every pause. */
export const endsAt = (s: Session) => s.startedAt + s.pausedMs + s.minutes * 60_000;

function props(s: Session): FocoProps {
  // While paused the activity shows a frozen timer: shift the range so it freezes at the right value.
  return {
    title: s.title,
    startedAt: s.startedAt + s.pausedMs,
    endsAt: endsAt(s),
    pausedAt: s.pausedAt,
    color: s.color,
    colorSoft: s.colorSoft,
    label: t('focus.live'),
    pausedLabel: t('focus.paused'),
  };
}

function pushActivity(s: Session) {
  if (!factory) return;
  try {
    const a = current();
    if (a) void a.update(props(s));
    else factory.start(props(s), `getgo://foco?id=${s.taskId}`);
  } catch (e) {
    console.warn('[foco] live activity', e);
  }
}

export function startFocus(task: { id: string; title: string }, minutes: number, color: string, colorSoft: string) {
  const existing = useFoco.getState().session;
  if (existing?.taskId === task.id) {
    pushActivity(existing);
    return existing;
  }
  const session: Session = { taskId: task.id, title: task.title, startedAt: Date.now(), minutes, pausedAt: null, pausedMs: 0, color, colorSoft };
  useFoco.setState({ session });
  pushActivity(session);
  blockForFocus();
  return session;
}

export function pauseFocus() {
  const s = useFoco.getState().session;
  if (!s || s.pausedAt) return;
  const next = { ...s, pausedAt: Date.now() };
  useFoco.setState({ session: next });
  pushActivity(next);
}

export function resumeFocus() {
  const s = useFoco.getState().session;
  if (!s || !s.pausedAt) return;
  const next = { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null };
  useFoco.setState({ session: next });
  pushActivity(next);
}

export function addMinutes(n: number) {
  const s = useFoco.getState().session;
  if (!s) return;
  const next = { ...s, minutes: s.minutes + n };
  useFoco.setState({ session: next });
  pushActivity(next);
}

/** Ends the session (done or given up). Returns the focused minutes. */
export function endFocus(): number {
  const s = useFoco.getState().session;
  if (s) {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const lives = useFoco.getState().lives ?? {};
    const cur = lives[day] ?? { s: 0, l: 0 };
    useFoco.setState({ lives: { ...lives, [day]: { s: cur.s + 1, l: cur.l + Math.min(s.leaves ?? 0, MAX_LEAVES) } } });
  }
  useFoco.setState({ session: null });
  unblockAll();
  try {
    for (const a of factory?.getInstances() ?? []) void a.end('immediate');
  } catch {
    // no live activity
  }
  return s ? elapsedMs(s) / 60_000 : 0;
}

/** Leaves before the mascot fades out completely and the grey waves come back. */
export const MAX_LEAVES = 3;

/** The app went to the background while focusing. */
export function wentAway() {
  const s = useFoco.getState().session;
  if (!s || s.pausedAt) return;
  useFoco.setState({ session: { ...s, awayAt: Date.now() } });
}

/** The app came back. A leave counts only when the person was gone more than a few seconds. */
export function cameBack(): boolean {
  const s = useFoco.getState().session;
  if (!s || !s.awayAt) return false;
  const counted = Date.now() - s.awayAt > 5000;
  useFoco.setState({ session: { ...s, awayAt: null, leaves: (s.leaves ?? 0) + (counted ? 1 : 0) } });
  return counted;
}
