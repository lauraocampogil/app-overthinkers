import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { planDay } from '@/lib/planner';
import { countToday, isoDay, START_FREEZES } from '@/lib/streak';
import { syncDay } from '@/lib/sync';
import type { PlannedTask, RawTask, Settings, Streak, Task } from '@/lib/types';

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

type DayState = {
  settings: Settings;
  streak: Streak;
  /** ISO date the current plan belongs to. */
  planDate: string | null;
  plan: PlannedTask[];
  /** Waiting list: carried over from other days or imported. Shown as "En espera". */
  later: Task[];
  /** Last brain dump, consumed by the "Ordenando" screen and then cleared. */
  draft: string;
  /** Per-day record for the streak calendar: a completed day or a day covered by a freeze. */
  history: Record<string, 'done' | 'freeze'>;

  setDraft: (text: string) => void;
  buildPlan: (raw: RawTask[], tired: boolean) => void;
  rollOverIfNewDay: () => void;
  markDone: (id: string) => void;
  shrink: (id: string) => void;
  postpone: (id: string) => void;
  drop: (id: string) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  add: (title: string) => void;
  move: (id: string, dir: -1 | 1) => void;
  reset: () => void;
};

const initial = {
  settings: { level: 'equilibrado', freeMinutes: 120, notifyAt: '08:00' } as Settings,
  streak: { current: 0, best: 0, freezes: START_FREEZES.equilibrado, lastCountedDate: null } as Streak,
  planDate: null as string | null,
  plan: [] as PlannedTask[],
  later: [] as Task[],
  draft: '',
  history: {} as Record<string, 'done' | 'freeze'>,
};

export const useDay = create<DayState>()(
  persist(
    (set, get) => {
      const patchTask = (id: string, fn: (t: PlannedTask) => PlannedTask) => {
        set({ plan: get().plan.map((t) => (t.id === id ? fn(t) : t)) });
        syncDay(get());
      };

      return {
        ...initial,

        setDraft: (draft) => set({ draft }),

        buildPlan: (raw, tired) => {
          const { settings, later } = get();
          const fresh: Task[] = raw.map((r) => ({ ...r, id: newId(), postponed: 0 }));
          // Carried-over tasks join today's dump; duplicates by title are skipped.
          const titles = new Set(fresh.map((t) => t.title.toLowerCase()));
          const carried = later.filter((t) => !titles.has(t.title.toLowerCase()));
          const result = planDay([...fresh, ...carried], { level: settings.level, freeMinutes: settings.freeMinutes, tired });
          set({ plan: result.planned, later: result.later, planDate: isoDay(new Date()), draft: '' });
          syncDay(get());
        },

        rollOverIfNewDay: () => {
          const { planDate, plan, later } = get();
          const today = isoDay(new Date());
          if (!planDate || planDate === today) return;
          const leftovers: Task[] = plan
            .filter((t) => t.status === 'pendiente')
            .map(({ why: _why, status: _status, ...t }) => ({ ...t, postponed: t.postponed + 1 }));
          set({ plan: [], planDate: null, later: [...leftovers, ...later] });
        },

        markDone: (id) => {
          patchTask(id, (t) => ({ ...t, status: 'hecha' }));
          const today = isoDay(new Date());
          const prev = get().streak.lastCountedDate;
          const outcome = countToday(get().streak, get().settings.level, today);
          const history = { ...get().history, [today]: 'done' as const };
          // Mark the missed days that a freeze covered, right after the last counted day.
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

        shrink: (id) =>
          patchTask(id, (t) => ({
            ...t,
            minutes: Math.max(10, round5(t.minutes / 2)),
            why: ['why.smaller'],
          })),

        postpone: (id) => {
          const task = get().plan.find((t) => t.id === id);
          if (!task) return;
          const { why: _why, status: _status, ...rest } = task;
          // Tomorrow it goes first: due today, one more postponement on record.
          set({ later: [{ ...rest, dueInDays: 0, postponed: rest.postponed + 1 }, ...get().later] });
          patchTask(id, (t) => ({ ...t, status: 'quitada' }));
        },

        drop: (id) => patchTask(id, (t) => ({ ...t, status: 'quitada' })),

        rename: (id, title) => patchTask(id, (t) => ({ ...t, title })),

        remove: (id) => {
          set({ plan: get().plan.filter((t) => t.id !== id) });
          syncDay(get());
        },

        add: (title) => {
          const task: PlannedTask = {
            id: newId(),
            title,
            minutes: 15,
            dueInDays: null,
            energy: 'baja',
            kind: 'otro',
            sport: null,
            importance: 2,
            postponed: 0,
            status: 'pendiente',
            why: ['why.added'],
          };
          set({ plan: [...get().plan, task] });
          syncDay(get());
        },

        move: (id, dir) => {
          const plan = [...get().plan];
          const i = plan.findIndex((t) => t.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= plan.length) return;
          [plan[i], plan[j]] = [plan[j], plan[i]];
          set({ plan });
          syncDay(get());
        },

        reset: () => set({ ...initial }),
      };
    },
    {
      name: 'getgo-day',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, streak, planDate, plan, later, history }) => ({ settings, streak, planDate, plan, later, history }),
    },
  ),
);

/** Helpers for screens. */
export const pendingTasks = (plan: PlannedTask[]) => plan.filter((t) => t.status === 'pendiente');
export const doneTasks = (plan: PlannedTask[]) => plan.filter((t) => t.status === 'hecha');
export const totalMinutes = (plan: PlannedTask[]) =>
  plan.filter((t) => t.status !== 'quitada').reduce((s, t) => s + t.minutes, 0);
