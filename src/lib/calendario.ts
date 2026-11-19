import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { dayWindow, freeMinutes, placeTasks, type Busy } from './agenda-plan';
import { addDays } from './planner';
import { isoDay } from './streak';
import type { Settings, Task } from './types';

/**
 * The phone's calendars (Apple, and Google / Outlook accounts added to the phone).
 * GetGo reads them to know when you are free, and can write its plan as blocks into its own "GetGo" calendar.
 */

const GETGO_TITLE = 'GetGo';
const DAYS_AHEAD = 14;
const WRITE_DAYS = 7;
const MARK = 'getgo:';

export type WritableCalendar = { id: string; title: string; source: string; color: string };

/** Calendars GetGo can write into: iCloud, Google, Outlook, work… whatever accounts are on the phone. */
export async function writableCalendars(): Promise<WritableCalendar[]> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals
    .filter((c) => c.allowsModifications)
    .map((c) => ({ id: c.id, title: c.title, source: c.source?.name ?? '', color: c.color ?? '#8A5CFF' }));
}

/** The phone's default calendar, used when the person has not picked one. */
/** Every calendar on the phone, grouped by account: iCloud (Apple), Google (also what Notion Calendar shows), Outlook… */
export type ReadableCalendar = { id: string; title: string; account: string; color: string };
export async function readableCalendars(): Promise<ReadableCalendar[]> {
  const perm = await Calendar.getCalendarPermissionsAsync();
  if (!perm.granted) return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals
    .map((c) => ({ id: c.id, title: c.title, account: c.source?.name || c.source?.type || '', color: c.color ?? '#8A8A8A' }))
    .sort((a, b) => a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
}

export async function defaultCalendarId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') return (await Calendar.getDefaultCalendarAsync()).id;
    return (await writableCalendars())[0]?.id ?? null;
  } catch {
    return (await writableCalendars())[0]?.id ?? null;
  }
}

type AgendaState = {
  status: 'off' | 'denied' | 'on';
  /** Busy events per ISO day (all-day events and GetGo's own blocks are left out). */
  busy: Record<string, Busy[]>;
  loadedAt: number;
};

export const useAgenda = create<AgendaState>(() => ({ status: 'off', busy: {}, loadedAt: 0 }));

export async function connectCalendar(): Promise<boolean> {
  const res = await Calendar.requestCalendarPermissionsAsync();
  useAgenda.setState({ status: res.granted ? 'on' : 'denied' });
  return res.granted;
}

async function getgoCalendarId(create: boolean): Promise<string | null> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const mine = cals.find((c) => c.title === GETGO_TITLE && c.allowsModifications);
  if (mine || !create) return mine?.id ?? null;
  const source =
    Platform.OS === 'ios'
      ? (await Calendar.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: GETGO_TITLE, type: Calendar.SourceType?.LOCAL ?? 'LOCAL' };
  return Calendar.createCalendarAsync({
    title: GETGO_TITLE,
    name: GETGO_TITLE,
    color: '#0A0A0A',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (source as { id?: string }).id,
    source: source as Calendar.Source,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel?.OWNER,
  });
}

/** Reads the next two weeks of events. Safe to call often; does nothing without permission. */
export async function refreshAgenda(settings: Settings): Promise<void> {
  if (settings.calendar === 'off') {
    useAgenda.setState({ status: 'off', busy: {} });
    return;
  }
  try {
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (!perm.granted) {
      useAgenda.setState({ status: 'denied', busy: {} });
      return;
    }
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const off = new Set(settings.calendarsOff ?? []);
    const ids = cals.filter((c) => !off.has(c.id)).map((c) => c.id);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + DAYS_AHEAD * 86_400_000);
    const events = ids.length ? await Calendar.getEventsAsync(ids, from, to) : [];
    const busy: Record<string, Busy[]> = {};
    for (const e of events) {
      // All-day events, "free" events and GetGo's own blocks don't take time away.
      if (e.allDay || e.availability === 'free' || (e.notes ?? '').startsWith(MARK)) continue;
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const day = isoDay(start);
      (busy[day] ??= []).push({ title: e.title || '—', start, end });
    }
    useAgenda.setState({ status: 'on', busy, loadedAt: Date.now() });
  } catch (e) {
    console.warn('[calendario] read failed', e);
  }
}

const dateOf = (iso: string) => new Date(`${iso}T12:00:00`);

/** Free minutes per day, used by the planner. undefined when the calendar is not connected. */
/**
 * Busy time from the person's own week, even with no calendar connected: work or classes on their days,
 * with the trip there and back (set by the app from the profile, see _layout).
 */
let extraBusy: (day: string) => Busy[] = () => [];
export function setExtraBusy(fn: (day: string) => Busy[]) {
  extraBusy = fn;
}
/** Everything already happening that day: calendar events, work or classes, the fixed week. */
export const busyOf = (day: string) => [...(useAgenda.getState().status === 'on' ? (useAgenda.getState().busy[day] ?? []) : []), ...extraBusy(day)];

/** Free minutes per day, to spread tasks over the week. Works with or without a connected calendar. */
export function capacityFor(settings: Settings) {
  return (day: string) => freeMinutes(dayWindow(dateOf(day), settings.dayStart, settings.dayEnd), busyOf(day));
}

const fixedStart = (day: string) => (t: Task) => (t.at ? new Date(`${day}T${t.at}:00`) : null);

/** Travel minutes before a task (set by the app from the person's home, see lib/trayecto). */
let travelOf: (t: Task) => number = () => 0;
export function setTravelOf(fn: (t: Task) => number) {
  travelOf = fn;
}

/** One day as a timeline with hours (events + task blocks) and what does not fit. */
export function dayTimeline(day: string, tasks: Task[], minutesOf: (t: Task) => number, settings: Settings) {
  const win = dayWindow(dateOf(day), settings.dayStart, settings.dayEnd);
  return placeTasks(tasks, minutesOf, win, busyOf(day), fixedStart(day), travelOf);
}

/** Today as a timeline with hours. */
export function todayTimeline(tasks: Task[], minutesOf: (t: Task) => number, settings: Settings) {
  return dayTimeline(isoDay(new Date()), tasks, minutesOf, settings);
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Puts the plan of the next 7 days into the calendar the person chose (or the phone's default one),
 * replacing GetGo's previous blocks. Each block keeps "getgo:<id>" in its notes so GetGo only ever touches its own events.
 * Debounced: the list can change several times in a row.
 */
export function writePlanToCalendar(allTasks: Task[], minutesOf: (t: Task) => number, settings: Settings) {
  if (settings.calendar !== 'write' || useAgenda.getState().status !== 'on') return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      const calId = settings.calendarTarget ?? (await defaultCalendarId()) ?? (await getgoCalendarId(true));
      if (!calId) return;
      const today = isoDay(new Date());
      const from = new Date(`${today}T00:00:00`);
      const to = new Date(`${addDays(today, WRITE_DAYS)}T00:00:00`);
      // Remove GetGo's previous blocks from every calendar (the person may have switched calendars).
      const cals = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).filter((c) => c.allowsModifications).map((c) => c.id);
      const old = cals.length ? await Calendar.getEventsAsync(cals, from, to) : [];
      await Promise.all(old.filter((e) => (e.notes ?? '').startsWith(MARK)).map((e) => Calendar.deleteEventAsync(e.id).catch(() => {})));
      for (let d = 0; d < WRITE_DAYS; d++) {
        const day = addDays(today, d);
        const pending = allTasks.filter((t) => t.status === 'pendiente' && (d === 0 ? t.day <= day : t.day === day));
        if (!pending.length) continue;
        const { blocks } = dayTimeline(day, pending, minutesOf, settings);
        for (const b of blocks) {
          if (b.type !== 'task') continue;
          const extra = [b.task.where ? `📍 ${b.task.where}` : '', ...b.task.checklist.map((i) => `${i.done ? '☑' : '☐'} ${i.text}`)].filter(Boolean);
          await Calendar.createEventAsync(calId, {
            title: b.task.title,
            startDate: b.start,
            endDate: b.end,
            location: b.task.where ?? undefined,
            notes: [`${MARK}${b.task.id}`, ...extra].join('\n'),
            alarms: [{ relativeOffset: 0 }],
          });
        }
      }
    } catch (e) {
      console.warn('[calendario] write failed', e);
    }
  }, 1500);
}

/** Events per day for a whole month (for the month view). Empty without permission. */
export async function monthEvents(settings: Settings, year: number, month: number): Promise<Record<string, number>> {
  if (settings.calendar === 'off') return {};
  try {
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (!perm.granted) return {};
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const off = new Set(settings.calendarsOff ?? []);
    const ids = cals.filter((c) => !off.has(c.id)).map((c) => c.id);
    if (!ids.length) return {};
    const events = await Calendar.getEventsAsync(ids, new Date(year, month, 1), new Date(year, month + 1, 1));
    const out: Record<string, number> = {};
    for (const e of events) {
      if ((e.notes ?? '').startsWith(MARK)) continue;
      const day = isoDay(new Date(e.startDate));
      out[day] = (out[day] ?? 0) + 1;
    }
    return out;
  } catch (e) {
    console.warn('[calendario] month failed', e);
    return {};
  }
}
