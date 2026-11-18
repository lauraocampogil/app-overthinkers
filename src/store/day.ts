import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { capacityFor, writePlanToCalendar } from '@/lib/calendario';
import { estimate, learn, type Learned } from '@/lib/duraciones';
import { addDays, schedule } from '@/lib/planner';
import { countToday, isoDay, START_FREEZES } from '@/lib/streak';
import { syncDay } from '@/lib/sync';
import type { ChecklistItem, Goal, ParseResult, RawGoal, RawTask, Routine, RoutineKind, Settings, Streak, Task } from '@/lib/types';

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
  /** How long this person really takes, per kind of task (see lib/duraciones). */
  learned: Learned;
  /** Task in focus mode and when it was started, to measure real durations. */
  focus: { id: string; startedAt: number } | null;
  goals: Goal[];
  /** Morning / night routines the person edited (missing = the default one, see routineOf). */
  routines: Partial<Record<RoutineKind, Routine>>;
  /** Steps ticked per day and routine: { '2026-11-18': { manana: ['id1'] } }. */
  routineLog: Record<string, Partial<Record<RoutineKind, string[]>>>;

  setDraft: (text: string) => void;
  /** New tasks from voice / text / screenshot: GetGo places them on the right days. */
  addTasks: (raw: RawTask[]) => AddResult;
  /** Full result from the AI: tasks and goals (each goal becomes its tasks). */
  addParsed: (result: Pick<ParseResult, 'tasks' | 'goals'>) => AddResult & { goals: number };
  toggleItem: (taskId: string, itemId: string) => void;
  addItem: (taskId: string, text: string) => void;
  setDetails: (taskId: string, patch: Partial<Pick<Task, 'where' | 'at'>>) => void;
  archiveGoal: (goalId: string) => void;
  addTitle: (title: string, day?: string) => void;
  rollOverIfNewDay: () => void;
  markDone: (id: string) => void;
  undoDone: (id: string) => void;
  moveTo: (id: string, day: string) => void;
  shrink: (id: string) => void;
  rename: (id: string, title: string) => void;
  /** The person sets how long a task takes; it also teaches GetGo for next time. */
  setMinutes: (id: string, minutes: number) => void;
  startFocus: (id: string) => void;
  /** Star / unstar a task as one of today's 3 most important. */
  toggleTop: (id: string) => void;
  setNeedsProof: (id: string, on: boolean) => void;
  /** Done with a photo that proves it (checked by the AI before calling this). */
  proveDone: (id: string, photo: string, offline: boolean) => void;
  setRoutine: (kind: RoutineKind, routine: Routine) => void;
  toggleRoutineStep: (kind: RoutineKind, stepId: string) => void;
  /** Re-plan with the latest calendar and durations. */
  replan: () => void;
  setSettings: (patch: Partial<Settings>) => void;
  remove: (id: string) => void;
  reset: () => void;
  /** Called after sign-in: wipes another account's local data and loads this account's copy from the server. */
  adoptUser: (userId: string, remote: RemoteSnapshot | null) => void;
};

export type RemoteSnapshot = Partial<Pick<DayState, 'settings' | 'streak' | 'tasks' | 'history' | 'learned' | 'goals' | 'routines'>>;

export const DEFAULT_SETTINGS: Settings = {
  level: 'equilibrado',
  freeMinutes: 120,
  notifyAt: '08:00',
  calendar: 'off',
  calendarTarget: null,
  dayStart: '08:00',
  dayEnd: '22:00',
};
/** Settings saved by older versions miss the newer fields. */
export const withDefaults = (s?: Partial<Settings> | null): Settings => ({ ...DEFAULT_SETTINGS, ...(s ?? {}) });

const initial = {
  settings: DEFAULT_SETTINGS,
  streak: { current: 0, best: 0, freezes: START_FREEZES.equilibrado, lastCountedDate: null } as Streak,
  tasks: [] as Task[],
  lastDay: null as string | null,
  draft: '',
  history: {} as Record<string, 'done' | 'freeze'>,
  owner: null as string | null,
  learned: {} as Learned,
  focus: null as { id: string; startedAt: number } | null,
  goals: [] as Goal[],
  routines: {} as Partial<Record<RoutineKind, Routine>>,
  routineLog: {} as Record<string, Partial<Record<RoutineKind, string[]>>>,
};

const items = (list?: string[]): ChecklistItem[] =>
  (list ?? []).filter((x) => x.trim()).map((text) => ({ id: newId(), text: text.trim(), done: false }));

/** Monday of the week that contains `iso`. */
export const weekStart = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const back = (d.getDay() + 6) % 7;
  return addDays(iso, -back);
};

/** Tasks a weekly goal still needs this week ("gym 3 veces" → up to 3 per week). */
function weeklyTasks(goal: Goal, tasks: Task[], day: string): Task[] {
  if (goal.type !== 'semanal' || !goal.perWeek || goal.archived) return [];
  const start = weekStart(day);
  const end = addDays(start, 6);
  const have = tasks.filter((t) => t.goalId === goal.id && (t.status === 'pendiente' ? t.day : (t.doneOn ?? t.day)) >= start && (t.status === 'pendiente' ? t.day : (t.doneOn ?? t.day)) <= end).length;
  const missing = Math.max(0, goal.perWeek - have);
  const tpl = goal.template ?? {};
  return Array.from({ length: missing }, () => ({
    ...fromRaw(
      {
        title: tpl.title ?? goal.title,
        minutes: tpl.minutes ?? null,
        dueInDays: null,
        energy: tpl.energy ?? 'alta',
        kind: tpl.kind ?? 'otro',
        importance: 2,
        sport: tpl.sport ?? null,
        checklist: tpl.checklist,
        where: tpl.where ?? null,
        at: tpl.at ?? null,
      },
      day,
    ),
    goalId: goal.id,
    due: end,
  }));
}

function fromRaw(r: RawTask, day: string): Task {
  const { dueInDays, checklist, goal: _goal, ...rest } = r;
  return {
    ...rest,
    where: r.where ?? null,
    at: r.at ?? null,
    proof: r.proof ?? null,
    needsProof: Boolean(r.proof),
    checklist: items(checklist),
    goalId: null,
    id: newId(),
    due: dueInDays === null || dueInDays === undefined ? null : addDays(day, Math.max(0, dueInDays)),
    day,
    pinned: false,
    postponed: 0,
    status: 'pendiente',
    why: [],
  };
}

/** Older saved tasks miss the newer fields. */
const normalize = (t: Task): Task => ({ ...t, checklist: t.checklist ?? [], goalId: t.goalId ?? null, where: t.where ?? null, at: t.at ?? null });

export const useDay = create<DayState>()(
  persist(
    (set, get) => {
      const minutesOf = (t: Task) => estimate(t, get().learned).minutes;
      const commit = (tasks: Task[]) => {
        const settings = withDefaults(get().settings);
        set({
          tasks: schedule(tasks, { level: settings.level, today: today(), minutesOf, capacity: capacityFor(settings) }),
        });
        syncDay(get());
        writePlanToCalendar(get().tasks, minutesOf, settings);
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

        addParsed: ({ tasks: raw, goals: rawGoals }) => {
          const day = today();
          const goals = [...get().goals];
          const fresh: Task[] = [];
          const findGoal = (title?: string | null) =>
            title ? goals.find((g) => !g.archived && g.title.toLowerCase() === title.toLowerCase()) : undefined;

          for (const rg of rawGoals ?? []) {
            let goal = findGoal(rg.title);
            if (!goal) {
              goal = {
                id: newId(),
                title: rg.title,
                type: rg.type,
                due: rg.dueInDays === null ? null : addDays(day, Math.max(0, rg.dueInDays)),
                perWeek: rg.perWeek,
                template: rg.template,
                createdOn: day,
              };
              goals.push(goal);
            }
            const g = goal;
            for (const step of rg.steps) {
              const t = fromRaw(step, day);
              fresh.push({ ...t, goalId: g.id, due: t.due ?? g.due, importance: g.type === 'largo' && !t.due ? 1 : t.importance });
            }
          }
          const existing = new Set(get().tasks.filter((t) => t.status === 'pendiente').map((t) => t.title.toLowerCase()));
          for (const r of raw) {
            const key = r.title.toLowerCase();
            if (existing.has(key)) continue;
            existing.add(key);
            fresh.push({ ...fromRaw(r, day), goalId: findGoal(r.goal)?.id ?? null });
          }
          const weekly = goals.flatMap((g) => weeklyTasks(g, [...get().tasks, ...fresh], day));
          set({ goals, draft: '' });
          commit([...get().tasks, ...fresh, ...weekly]);
          const ids = new Set([...fresh, ...weekly].map((t) => t.id));
          const placed = get().tasks.filter((t) => ids.has(t.id));
          const forToday = placed.filter((t) => t.day === day).length;
          return { added: placed.length, today: forToday, later: placed.length - forToday, goals: (rawGoals ?? []).length };
        },

        toggleItem: (taskId, itemId) =>
          patch(taskId, (t) => ({ ...t, checklist: t.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) })),

        addItem: (taskId, text) =>
          patch(taskId, (t) => ({ ...t, checklist: [...t.checklist, ...items([text])] })),

        setDetails: (taskId, patchIn) => patch(taskId, (t) => ({ ...t, ...patchIn })),

        archiveGoal: (goalId) => {
          set({ goals: get().goals.map((g) => (g.id === goalId ? { ...g, archived: true } : g)) });
          commit(get().tasks.filter((t) => !(t.goalId === goalId && t.status === 'pendiente')));
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
          const weekly = get().goals.flatMap((g) => weeklyTasks(g, tasks, day));
          set({ lastDay: day });
          commit([...tasks, ...weekly]);
        },

        markDone: (id) => {
          const day = today();
          // Finished in focus mode: the real time spent teaches GetGo how long this takes for you.
          const focus = get().focus;
          const task = get().tasks.find((t) => t.id === id);
          if (focus && focus.id === id && task) {
            set({ learned: learn(get().learned, task, (Date.now() - focus.startedAt) / 60_000), focus: null });
          }
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

        setMinutes: (id, minutes) => {
          const task = get().tasks.find((t) => t.id === id);
          if (task) set({ learned: learn(get().learned, task, minutes) });
          patch(id, (t) => ({ ...t, minutes }));
        },

        startFocus: (id) => {
          if (get().focus?.id !== id) set({ focus: { id, startedAt: Date.now() } });
        },

        toggleTop: (id) => {
          const day = today();
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return;
          // Only 3 stars a day: starring a 4th takes the star off the oldest one.
          let tasks = get().tasks;
          if (!task.top) {
            const starred = tasks.filter((t) => t.top && t.status === 'pendiente' && t.day <= day);
            if (starred.length >= 3) tasks = tasks.map((t) => (t.id === starred[0].id ? { ...t, top: false } : t));
          }
          commit(tasks.map((t) => (t.id === id ? { ...t, top: !t.top, ...(t.day > day && !t.top ? { day, pinned: true } : {}) } : t)));
        },

        setNeedsProof: (id, on) => patch(id, (t) => ({ ...t, needsProof: on })),

        proveDone: (id, photo, offline) => {
          set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, proofPhoto: photo, proofOffline: offline } : t)) });
          get().markDone(id);
        },

        setRoutine: (kind, routine) => {
          set({ routines: { ...get().routines, [kind]: routine } });
          syncDay(get());
        },

        toggleRoutineStep: (kind, stepId) => {
          const day = today();
          const log = get().routineLog;
          const doneIds = log[day]?.[kind] ?? [];
          const next = doneIds.includes(stepId) ? doneIds.filter((x) => x !== stepId) : [...doneIds, stepId];
          // Keep two weeks of routine history.
          const oldest = addDays(day, -14);
          const kept = Object.fromEntries(Object.entries(log).filter(([d]) => d >= oldest));
          set({ routineLog: { ...kept, [day]: { ...kept[day], [kind]: next } } });
        },

        replan: () => commit(get().tasks),

        setSettings: (patch) => {
          set({ settings: withDefaults({ ...get().settings, ...patch }) });
          commit(get().tasks);
        },

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
              settings: withDefaults({ ...get().settings, ...remote.settings }),
              learned: { ...remote.learned, ...get().learned },
              goals: [...get().goals, ...(remote.goals ?? []).filter((g) => !get().goals.some((x) => x.id === g.id))],
              routines: { ...remote.routines, ...get().routines },
              streak: remote.streak ?? get().streak,
              history: { ...remote.history, ...get().history },
              tasks: [...local, ...(remote.tasks ?? []).filter((t) => !ids.has(t.id))].map(normalize),
            });
          }
          set({ lastDay: null });
          get().rollOverIfNewDay();
        },
      };
    },
    {
      name: 'getgo-day',
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, streak, tasks, lastDay, history, owner, learned, focus, goals, routines, routineLog }) => ({
        goals,
        routines,
        routineLog,
        settings,
        streak,
        tasks,
        lastDay,
        history,
        owner,
        learned,
        focus,
      }),
      // v1 kept "plan" (today) and "later" (waiting list) apart: fold both into the single list.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version >= 2)
          return {
            ...s,
            settings: withDefaults(s.settings as Partial<Settings>),
            learned: s.learned ?? {},
            goals: s.goals ?? [],
            routines: s.routines ?? {},
            routineLog: s.routineLog ?? {},
            tasks: ((s.tasks as Task[]) ?? []).map(normalize),
          } as never;
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
          checklist: [],
          goalId: null,
          where: null,
          at: null,
        });
        const plan = ((s.plan as Old[]) ?? []).filter((t) => t.status !== 'quitada').map(conv);
        const later = ((s.later as Old[]) ?? []).map(conv);
        return {
          settings: withDefaults(s.settings as Partial<Settings>),
          streak: s.streak ?? initial.streak,
          history: s.history ?? {},
          owner: s.owner ?? null,
          tasks: [...plan, ...later],
          goals: [],
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

/** Progress of a goal: done / total of its tasks, or this week's count for weekly goals. */
export function goalProgress(goal: Goal, tasks: Task[]) {
  const mine = tasks.filter((t) => t.goalId === goal.id);
  if (goal.type === 'semanal' && goal.perWeek) {
    const start = weekStart(today());
    const done = mine.filter((t) => t.status === 'hecha' && (t.doneOn ?? '') >= start).length;
    return { done, total: goal.perWeek, next: mine.filter((t) => t.status === 'pendiente') };
  }
  const done = mine.filter((t) => t.status === 'hecha').length;
  return { done, total: mine.length, next: mine.filter((t) => t.status === 'pendiente') };
}
