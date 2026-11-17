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
const MARK = 'getgo:';

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
    color: '#8A5CFF',
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
    const ids = cals.filter((c) => c.title !== GETGO_TITLE).map((c) => c.id);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + DAYS_AHEAD * 86_400_000);
    const events = ids.length ? await Calendar.getEventsAsync(ids, from, to) : [];
    const busy: Record<string, Busy[]> = {};
    for (const e of events) {
      if (e.allDay || e.availability === 'free') continue;
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
export function capacityFor(settings: Settings) {
  const { status, busy } = useAgenda.getState();
  if (status !== 'on') return undefined;
  return (day: string) => freeMinutes(dayWindow(dateOf(day), settings.dayStart, settings.dayEnd), busy[day] ?? []);
}

/** Today as a timeline with hours. */
export function todayTimeline(tasks: Task[], minutesOf: (t: Task) => number, settings: Settings) {
  const day = isoDay(new Date());
  const win = dayWindow(new Date(), settings.dayStart, settings.dayEnd);
  return placeTasks(tasks, minutesOf, win, useAgenda.getState().busy[day] ?? []);
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Writes today's task blocks into the "GetGo" calendar (creating it once), replacing the previous ones.
 * Debounced: the list can change several times in a row.
 */
export function writePlanToCalendar(tasks: Task[], minutesOf: (t: Task) => number, settings: Settings) {
  if (settings.calendar !== 'write' || useAgenda.getState().status !== 'on') return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      const calId = await getgoCalendarId(true);
      if (!calId) return;
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(addDays(isoDay(from), 1) + 'T00:00:00');
      const old = await Calendar.getEventsAsync([calId], from, to);
      await Promise.all(old.filter((e) => (e.notes ?? '').startsWith(MARK)).map((e) => Calendar.deleteEventAsync(e.id)));
      const { blocks } = todayTimeline(tasks, minutesOf, settings);
      for (const b of blocks) {
        if (b.type !== 'task') continue;
        await Calendar.createEventAsync(calId, {
          title: b.task.title,
          startDate: b.start,
          endDate: b.end,
          notes: `${MARK}${b.task.id}`,
          alarms: [{ relativeOffset: 0 }],
        });
      }
    } catch (e) {
      console.warn('[calendario] write failed', e);
    }
  }, 1500);
}
