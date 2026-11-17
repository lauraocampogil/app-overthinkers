import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addDays, schedule } from '@/lib/planner';
import { countToday, isoDay, START_FREEZES } from '@/lib/streak';
import { syncDay } from '@/lib/sync';
import type { RawTask, Settings, Streak, Task } from '@/lib/types';

/**
 * One list for everything. Every task has a day; GetGo decides it (planner.schedule)
 * unless the person moved the task by hand. The home screen shows today, tomorrow and the days after.
 * The streak counts the days on which today's list was finished.
 */

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const today = () => isoDay(new Date());
const KEEP_DONE_DAYS = 30;

export type AddResult = { added: number; today: number; later: number };

type DayState = {
  settings: Settings;
  streak: Streak;
  tasks: Task[];
  /** Last day the list was re-planned (to roll unfinished tasks over each morning). */
  lastDay: string | null;
  /** Last brain dump, consumed by the "Ordenando" screen and then cleared. */
  draft: string;
  /** Per-day record for the streak calendar: a finished day or a day covered by a freeze. */
  history: Record<string, 'done' | 'freeze'>;
  /** Account the local data belongs to. A different account on this phone starts from its own data. */
  owner: string | null;

  setDraft: (text: string) => void;
  /** New tasks from voice / text / screenshot: GetGo places them on the right days. */
  addTasks: (raw: RawTask[]) => AddResult;
  addTitle: (title: string, day?: string) => void;
  rollOverIfNewDay: () => void;
  markDone: (id: string) => void;
  undoDone: (id: string) => void;
  moveTo: (id: string, day: string) => void;
  shrink: (id: string) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  reset: () => void;
  /** Called after sign-in: wipes another account's local data and loads this account's copy from the server. */
  adoptUser: (userId: string, remote: RemoteSnapshot | null) => void;
};

export type RemoteSnapshot = Partial<Pick<DayState, 'settings' | 'streak' | 'tasks' | 'history'>>;

const initial = {
  settings: { level: 'equilibrado', freeMinutes: 120, notifyAt: '08:00' } as Settings,
  streak: { current: 0, best: 0, freezes: START_FREEZES.equilibrado, lastCountedDate: null } as Streak,
  tasks: [] as Task[],
  lastDay: null as string | null,
  draft: '',
  history: {} as Record<string, 'done' | 'freeze'>,
  owner: null as string | null,
};

const fromRaw = (r: RawTask, day: string): Task => {
  const { dueInDays, ...rest } = r;
  return {
    ...rest,
    id: newId(),
    due: dueInDays === null || dueInDays === undefined ? null : addDays(day, Math.max(0, dueInDays)),
    day,
    pinned: false,
    postponed: 0,
    status: 'pendiente',
    why: [],
  };
};

export const useDay = create<DayState>()(
  persist(
    (set, get) => {
      const commit = (tasks: Task[]) => {
        set({ tasks: schedule(tasks, { level: get().settings.level, today: today() }) });
        syncDay(get());
      };
      const patch = (id: string, fn: (t: Task) => Task) => commit(get().tasks.map((t) => (t.id === id ? fn(t) : t)));

      return {
        ...initial,

        setDraft: (draft) => set({ draft }),

        addTasks: (raw) => {
          const day = today();
          const existing = new Set(get().tasks.filter((t) => t.status === 'pendiente').map((t) => t.title.toLowerCase()));
          const fresh: Task[] = [];
          for (const r of raw) {
            const key = r.title.toLowerCase();
            if (existing.has(key)) continue; // already in the list
            existing.add(key);
            fresh.push(fromRaw(r, day));
          }
          set({ draft: '' });
          commit([...get().tasks, ...fresh]);
          const ids = new Set(fresh.map((t) => t.id));
          const placed = get().tasks.filter((t) => ids.has(t.id));
          const forToday = placed.filter((t) => t.day === day).length;
          return { added: placed.length, today: forToday, later: placed.length - forToday };
        },

        addTitle: (title, day) => {
          const task = fromRaw(
            { title, minutes: null, dueInDays: null, energy: 'baja', kind: 'otro', importance: 2, sport: null },
            today(),
          );
          commit([...get().tasks, day ? { ...task, day, pinned: true } : task]);
        },

        rollOverIfNewDay: () => {
          const day = today();
          if (get().lastDay === day) return;
          const oldest = addDays(day, -KEEP_DONE_DAYS);
          const tasks = get()
            .tasks.filter((t) => t.status === 'pendiente' || (t.doneOn ?? day) >= oldest)
            .map((t) =>
              // Unfinished from a past day: comes back today with priority, no longer pinned to the old day.
              t.status === 'pendiente' && t.day < day ? { ...t, pinned: false, postponed: t.postponed + 1 } : t,
            );
          set({ lastDay: day });
          commit(tasks);
        },

        markDone: (id) => {
          const day = today();
          patch(id, (t) => ({ ...t, status: 'hecha', doneOn: day }));
          // The streak counts when today's list is finished.
          const leftToday = get().tasks.some((t) => t.status === 'pendiente' && t.day <= day);
          if (leftToday) return;
          const prev = get().streak.lastCountedDate;
          const outcome = countToday(get().streak, get().settings.level, day);
          const history = { ...get().history, [day]: 'done' as const };
          if (prev && outcome.usedFreezes > 0) {
            const d = new Date(`${prev}T12:00:00`);
            for (let i = 0; i < outcome.usedFreezes; i++) {
              d.setDate(d.getDate() + 1);
              history[isoDay(d)] = 'freeze';
            }
          }
          set({ streak: outcome.streak, history });
          syncDay(get());
        },

        undoDone: (id) => patch(id, (t) => ({ ...t, status: 'pendiente', doneOn: undefined })),

        moveTo: (id, day) =>
          patch(id, (t) => ({ ...t, day, pinned: true, postponed: day > t.day ? t.postponed + 1 : t.postponed })),

        shrink: (id) =>
          patch(id, (t) => ({
            ...t,
            minutes: t.minutes === null ? null : Math.max(5, round5(t.minutes / 2)),
            why: ['why.smaller'],
          })),

        rename: (id, title) => patch(id, (t) => ({ ...t, title })),

        remove: (id) => commit(get().tasks.filter((t) => t.id !== id)),

        reset: () => set({ ...initial }),

        adoptUser: (userId, remote) => {
          const sameOwner = get().owner === userId;
          if (!sameOwner) set({ ...initial, owner: userId });
          if (remote) {
            // Another account: the server copy wins. Same account: merge, local edits win for the same task.
            const local = sameOwner ? get().tasks : [];
            const ids = new Set(local.map((t) => t.id));
            set({
              settings: { ...get().settings, ...remote.settings },
              streak: remote.streak ?? get().streak,
              history: { ...remote.history, ...get().history },
              tasks: [...local, ...(remote.tasks ?? []).filter((t) => !ids.has(t.id))],
            });
          }
          set({ lastDay: null });
          get().rollOverIfNewDay();
        },
      };
    },
    {
      name: 'getgo-day',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, streak, tasks, lastDay, history, owner }) => ({ settings, streak, tasks, lastDay, history, owner }),
      // v1 kept "plan" (today) and "later" (waiting list) apart: fold both into the single list.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 2) return s as never;
        const day = (s.planDate as string | null) ?? today();
        type Old = Omit<RawTask, 'dueInDays'> & { id: string; dueInDays: number | null; postponed?: number; status?: string };
        const conv = (t: Old): Task => ({
          id: t.id,
          title: t.title,
          minutes: t.minutes ?? null,
          energy: t.energy,
          kind: t.kind,
          importance: t.importance ?? 2,
          sport: t.sport ?? null,
          due: t.dueInDays === null || t.dueInDays === undefined ? null : addDays(day, t.dueInDays),
          day,
          pinned: false,
          postponed: t.postponed ?? 0,
          status: t.status === 'hecha' ? 'hecha' : 'pendiente',
          doneOn: t.status === 'hecha' ? day : undefined,
          why: [],
        });
        const plan = ((s.plan as Old[]) ?? []).filter((t) => t.status !== 'quitada').map(conv);
        const later = ((s.later as Old[]) ?? []).map(conv);
        return {
          settings: s.settings ?? initial.settings,
          streak: s.streak ?? initial.streak,
          history: s.history ?? {},
          owner: s.owner ?? null,
          tasks: [...plan, ...later],
          lastDay: null,
        } as never;
      },
    },
  ),
);

/** Helpers for screens. */
export const todayIso = today;
export const tasksOn = (tasks: Task[], day: string) => tasks.filter((t) => t.day === day && t.status === 'pendiente');
/** Today's list: what is planned for today plus what was finished today. */
export const todayList = (tasks: Task[]) => {
  const day = today();
  return tasks.filter((t) => (t.status === 'pendiente' && t.day <= day) || (t.status === 'hecha' && t.doneOn === day));
};
/** Pending tasks after today, grouped by day in order. */
export const upcoming = (tasks: Task[]) => {
  const day = today();
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.status !== 'pendiente' || t.day <= day) continue;
    groups.set(t.day, [...(groups.get(t.day) ?? []), t]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};
