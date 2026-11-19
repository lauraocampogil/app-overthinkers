/**
 * Turns today's ordered tasks + the calendar's events into a real day with hours.
 * Pure (no native calls) so it is easy to test.
 */
export type Busy = { title: string; start: Date; end: Date };
export type Block<T> =
  | { type: 'event'; title: string; start: Date; end: Date }
  | { type: 'task'; task: T; start: Date; end: Date };

export type DayWindow = { start: Date; end: Date };

const MIN = 60_000;
const BUFFER = 10; // minutes of breathing room between blocks

const hm = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const x = new Date(d);
  x.setHours(h || 0, m || 0, 0, 0);
  return x;
};
const ceil5 = (d: Date) => new Date(Math.ceil(d.getTime() / (5 * MIN)) * 5 * MIN);

/** The usable part of a day: from dayStart (or now, if later) to dayEnd. */
export function dayWindow(day: Date, dayStart: string, dayEnd: string, now = new Date()): DayWindow {
  const start = hm(day, dayStart);
  const end = hm(day, dayEnd);
  const sameDay = now.toDateString() === day.toDateString();
  return { start: sameDay && now > start ? ceil5(now) : start, end };
}

/** Free intervals inside the window once events are taken out. */
export function freeSlots(win: DayWindow, busy: Busy[]): { start: Date; end: Date }[] {
  const sorted = busy
    .filter((b) => b.end > win.start && b.start < win.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const slots: { start: Date; end: Date }[] = [];
  let cursor = win.start;
  for (const b of sorted) {
    if (b.start > cursor) slots.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < win.end) slots.push({ start: cursor, end: win.end });
  return slots.filter((s) => s.end.getTime() - s.start.getTime() >= 5 * MIN);
}

export const freeMinutes = (win: DayWindow, busy: Busy[]) =>
  freeSlots(win, busy).reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()) / MIN, 0);

/**
 * Places tasks, in order, into the first free gap where they fit (with a short buffer).
 * Returns the day as a timeline (events + task blocks) and the tasks that did not fit today.
 */
export function placeTasks<T>(
  tasks: T[],
  minutesOf: (t: T) => number,
  win: DayWindow,
  busy: Busy[],
  /** A fixed start time for tasks the person gave an hour to ("a las 18:00"). */
  fixedStart?: (t: T) => Date | null,
  /** Minutes of travel needed before the task (its place, from home): kept free, never planned over. */
  travelOf?: (t: T) => number,
) {
  const travel = (t: T) => (travelOf?.(t) ?? 0) * MIN;
  // Tasks with a fixed hour go first, exactly at that hour, and then count as busy time.
  const fixed: Block<T>[] = [];
  const flexible: T[] = [];
  for (const task of tasks) {
    const at = fixedStart?.(task) ?? null;
    if (at) fixed.push({ type: 'task', task, start: at, end: new Date(at.getTime() + minutesOf(task) * MIN) });
    else flexible.push(task);
  }
  const taken = [...busy, ...fixed.map((b) => ({ title: '', start: new Date(b.start.getTime() - (b.type === 'task' ? travel(b.task) : 0)), end: new Date(b.end.getTime() + BUFFER * MIN) }))];
  const slots = freeSlots(win, taken).map((s) => ({ ...s }));
  const blocks: Block<T>[] = [...fixed];
  blocks.push(...busy
    .filter((b) => b.end > win.start && b.start < win.end)
    .map((b) => ({ type: 'event' as const, title: b.title, start: b.start, end: b.end })));
  const overflow: T[] = [];

  for (const task of flexible) {
    const way = travel(task);
    const need = minutesOf(task) * MIN;
    const slot = slots.find((s) => s.end.getTime() - s.start.getTime() >= need + way);
    if (!slot) {
      overflow.push(task);
      continue;
    }
    // The trip comes first: the task starts once you are there.
    const start = new Date(slot.start.getTime() + way);
    const end = new Date(start.getTime() + need);
    blocks.push({ type: 'task', task, start, end });
    slot.start = new Date(end.getTime() + BUFFER * MIN);
  }
  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { blocks, overflow };
}
