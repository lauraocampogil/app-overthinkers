import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { capacityFor, writePlanToCalendar } from '@/lib/calendario';
import { estimate, learn, type Learned } from '@/lib/duraciones';
import { addDays, schedule } from '@/lib/planner';
import { countToday, isoDay, START_FREEZES } from '@/lib/streak';
import { syncDay } from '@/lib/sync';
import { EMPTY_PROFILE, sameGoal, type FixedItem, type Profile } from '@/lib/perfil';
import { RETOS, retoStepId, type Reto, type RetoId } from '@/lib/retos';
import { defaultRoutine } from '@/lib/rutinas';
import { t } from '@/i18n';
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
  /** Filled in the onboarding: the 3 areas of life, stores, day window, energy… */
  profile: Profile;
  /** Minutes of focus per day (from finished focus sessions), for the progress screen. */
  focusLog: Record<string, number>;
  /** Challenges proposed / accepted / declined. */
  retos: Reto[];

  setDraft: (text: string) => void;
  /** New tasks from voice / text / screenshot: GetGo places them on the right days. */
  addTasks: (raw: RawTask[]) => AddResult;
  /** Full result from the AI: tasks and goals (each goal becomes its tasks). */
  addParsed: (result: Pick<ParseResult, 'tasks' | 'goals'>, opts?: { pinDays?: boolean }) => AddResult & { goals: number };
  /** Week planned (to show "Planifica tu semana" only once a week). */
  weekPlannedOn: string | null;
  /** Pop-ups on Hoy: the day the last challenge was offered (one per day) and the day "later" was tapped. */
  nudges: { retoOn?: string; laterOn?: string; doneOn?: string };
  setNudge: (patch: { retoOn?: string; laterOn?: string; doneOn?: string }) => void;
  toggleItem: (taskId: string, itemId: string) => void;
  addItem: (taskId: string, text: string) => void;
  setItemText: (taskId: string, itemId: string, text: string) => void;
  removeItem: (taskId: string, itemId: string) => void;
  setDetails: (taskId: string, patch: Partial<Pick<Task, 'where' | 'at'>>) => void;
  archiveGoal: (goalId: string) => void;
  updateGoal: (goalId: string, patch: Partial<Pick<Goal, 'title' | 'type' | 'due' | 'perWeek' | 'vision'>>) => void;
  /** Today's check-in for a goal (merged with any earlier one today). */
  addCheckin: (goalId: string, entry: { value?: number; photo?: string }) => void;
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
  setProfile: (patch: Partial<Profile>) => void;
  /** Save the fixed week and put its tasks on the next 7 days. */
  setFixed: (items: FixedItem[]) => void;
  offerReto: (id: RetoId, goalId: string | null) => void;
  /** Accept: it joins its routine. Decline: GetGo won't propose it again for two weeks. */
  answerReto: (id: RetoId, accept: boolean) => void;
  toggleRoutineStep: (kind: RoutineKind, stepId: string) => void;
  /** Re-plan with the latest calendar and durations. */
  replan: () => void;
  setSettings: (patch: Partial<Settings>) => void;
  remove: (id: string) => void;
  reset: () => void;
  /** Called after sign-in: wipes another account's local data and loads this account's copy from the server. */
  adoptUser: (userId: string, remote: RemoteSnapshot | null) => void;
};

export type RemoteSnapshot = Partial<Pick<DayState, 'settings' | 'streak' | 'tasks' | 'history' | 'learned' | 'goals' | 'routines' | 'profile'>>;

export const DEFAULT_SETTINGS: Settings = {
  level: 'equilibrado',
  freeMinutes: 120,
  notifyAt: '08:00',
  calendar: 'off',
  calendarTarget: null,
  calendarsOff: [],
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
  profile: EMPTY_PROFILE,
  focusLog: {} as Record<string, number>,
  retos: [] as Reto[],
  weekPlannedOn: null as string | null,
  nudges: {} as { retoOn?: string; laterOn?: string; doneOn?: string },
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
  // Spread the sessions over the days left this week (gym 3× → e.g. Mon, Wed, Fri), not all today.
  const daysLeft = Array.from({ length: daysBetweenIso(day, end) + 1 }, (_, i) => addDays(day, i));
  const spot = (k: number) => daysLeft[Math.min(daysLeft.length - 1, Math.floor((k * daysLeft.length) / Math.max(1, missing)))];
  return Array.from({ length: missing }, (_, k) => ({
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
    day: spot(k),
    pinned: true,
  }));
}

/** Tasks of the fixed week for the 7 days from `from` that do not exist yet (each item once per matching day). */
function fixedTasks(items: FixedItem[], tasks: Task[], from: string): Task[] {
  const out: Task[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    const dow = new Date(`${day}T12:00:00`).getDay();
    for (const f of items) {
      if (!f.days.includes(dow)) continue;
      if (tasks.some((t) => t.fixedId === f.id && (t.status === 'pendiente' ? t.day : (t.doneOn ?? t.day)) === day)) continue;
      out.push({
        ...fromRaw({ title: f.text, minutes: f.minutes, dueInDays: null, energy: 'alta', kind: 'otro', importance: 2, where: null, at: f.at }, day),
        fixedId: f.id,
        day,
        due: null,
        pinned: true,
      });
    }
  }
  return out;
}

const daysBetweenIso = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);

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

        addParsed: ({ tasks: raw, goals: rawGoals }, opts) => {
          const day = today();
          const goals = [...get().goals];
          const fresh: Task[] = [];
          const findGoal = (title?: string | null) => (title ? goals.find((g) => !g.archived && sameGoal(g.title, title)) : undefined);

          for (const rg of rawGoals ?? []) {
            let goal = findGoal(rg.title);
            if (goal) {
              // Same goal said again: keep one, with the newest wording and date.
              const g0 = goal;
              goal = { ...g0, title: rg.title, due: rg.dueInDays === null ? g0.due : addDays(day, Math.max(0, rg.dueInDays)), perWeek: rg.perWeek ?? g0.perWeek };
              goals[goals.indexOf(g0)] = goal;
            }
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
            const t0 = { ...fromRaw(r, day), goalId: findGoal(r.goal)?.id ?? null };
            // Week plan: the task stays on the day the plan gave it (dueInDays = day it is done).
            fresh.push(opts?.pinDays && r.dueInDays !== null && r.dueInDays !== undefined ? { ...t0, day: addDays(day, r.dueInDays), due: null, pinned: true } : t0);
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

        setItemText: (taskId, itemId, text) =>
          patch(taskId, (t) => ({ ...t, checklist: t.checklist.map((i) => (i.id === itemId ? { ...i, text } : i)) })),

        removeItem: (taskId, itemId) => patch(taskId, (t) => ({ ...t, checklist: t.checklist.filter((i) => i.id !== itemId) })),

        addItem: (taskId, text) =>
          patch(taskId, (t) => ({ ...t, checklist: [...t.checklist, ...items([text])] })),

        setDetails: (taskId, patchIn) => patch(taskId, (t) => ({ ...t, ...patchIn })),

        addCheckin: (goalId, entry) => {
          const day = today();
          set({
            goals: get().goals.map((g) => {
              if (g.id !== goalId) return g;
              const list = g.checkins ?? [];
              const prev = list.find((c) => c.date === day);
              const next = { ...prev, ...entry, date: day };
              return { ...g, checkins: [...list.filter((c) => c.date !== day), next].sort((a, b) => a.date.localeCompare(b.date)) };
            }),
          });
          syncDay(get());
        },

        updateGoal: (goalId, patchIn) => {
          const goals = get().goals.map((g) => (g.id === goalId ? { ...g, ...patchIn } : g));
          set({ goals });
          // A weekly goal with more sessions now gets them this week.
          const extra = goals.flatMap((g) => (g.id === goalId ? weeklyTasks(g, get().tasks, today()) : []));
          commit([...get().tasks, ...extra]);
        },

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
            .tasks.filter((t) => t.status === 'pendiente' || (t.doneOn ?? day) >= (t.proofPhoto ? addDays(day, -365) : oldest))
            .map((t) =>
              // Unfinished from a past day: comes back today with priority, no longer pinned to the old day.
              t.status === 'pendiente' && t.day < day ? { ...t, pinned: false, postponed: t.postponed + 1 } : t,
            );
          // Duplicated goals from earlier versions: merge them into the first one.
          const goals = [...get().goals];
          const moved = new Map<string, string>();
          goals.forEach((g, i) => {
            if (g.archived || moved.has(g.id)) return;
            goals.slice(i + 1).forEach((h) => {
              if (!h.archived && !moved.has(h.id) && sameGoal(g.title, h.title)) moved.set(h.id, g.id);
            });
          });
          const merged = goals.map((g) => (moved.has(g.id) ? { ...g, archived: true } : g));
          const relinked = tasks.map((t) => (t.goalId && moved.has(t.goalId) ? { ...t, goalId: moved.get(t.goalId)! } : t));
          const weekly = merged.flatMap((g) => weeklyTasks(g, relinked, day));
          set({ lastDay: day, goals: merged });
          // Challenges kept at least 5 of the last 7 days grow a little (once a week).
          const log = get().routineLog;
          const retos = get().retos.map((r) => {
            const def = RETOS[r.id];
            if (r.status !== 'accepted' || !def.step || r.n >= def.max) return r;
            const since = Math.round((Date.parse(`${day}T12:00:00`) - Date.parse(`${r.since}T12:00:00`)) / 86_400_000);
            if (since < 7) return r;
            const kept = Array.from({ length: 7 }, (_, i) => addDays(day, -1 - i)).filter((d) => (log[d]?.[def.routine] ?? []).includes(retoStepId(r.id))).length;
            return kept >= 5 ? { ...r, n: Math.min(def.max, r.n + def.step), since: day } : { ...r, since: day };
          });
          set({ retos });
          for (const r of retos) {
            const def = RETOS[r.id];
            const routine = get().routines[def.routine];
            if (r.status !== 'accepted' || !routine) continue;
            const text = retoText(r.id, r.n);
            if (routine.steps.some((s) => s.id === retoStepId(r.id) && s.text !== text))
              set({ routines: { ...get().routines, [def.routine]: { ...routine, steps: routine.steps.map((s) => (s.id === retoStepId(r.id) ? { ...s, text } : s)) } } });
          }
          commit([...relinked, ...weekly, ...fixedTasks(get().profile.fixed ?? [], [...relinked, ...weekly], day)]);
        },

        markDone: (id) => {
          const day = today();
          // Finished in focus mode: the real time spent teaches GetGo how long this takes for you.
          const focus = get().focus;
          const task = get().tasks.find((t) => t.id === id);
          if (focus && focus.id === id && task) {
            const mins = (Date.now() - focus.startedAt) / 60_000;
            const log = get().focusLog ?? {};
            set({
              learned: learn(get().learned, task, mins),
              focus: null,
              focusLog: { ...log, [day]: Math.round((log[day] ?? 0) + Math.min(mins, 240)) },
            });
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

        setFixed: (items) => {
          const day = today();
          set({ profile: { ...EMPTY_PROFILE, ...get().profile, fixed: items } });
          // Pending copies of removed items, or on days no longer chosen, go away; new ones are added.
          const kept = get().tasks.filter((t) => {
            if (!t.fixedId || t.status !== 'pendiente') return true;
            const f = items.find((x) => x.id === t.fixedId);
            return !!f && f.days.includes(new Date(`${t.day}T12:00:00`).getDay());
          });
          commit([...kept, ...fixedTasks(items, kept, day)]);
          syncDay(get());
        },
        setProfile: (patchIn) => {
          set({ profile: { ...EMPTY_PROFILE, ...get().profile, ...patchIn } });
          syncDay(get());
        },

        setNudge: (patch) => set({ nudges: { ...get().nudges, ...patch } }),
        offerReto: (id, goalId) => {
          // One challenge a day: never a second offer on the same day, whatever the answer to the first.
          if (get().nudges.retoOn === today() || get().retos.some((r) => r.status === 'offered')) return;
          set({ nudges: { ...get().nudges, retoOn: today() } });
          set({ retos: [...get().retos.filter((r) => r.id !== id), { id, status: 'offered', n: RETOS[id].start, goalId, since: today() }] });
        },

        answerReto: (id, accept) => {
          const reto = get().retos.find((r) => r.id === id);
          if (!reto) return;
          set({ retos: get().retos.map((r) => (r.id === id ? { ...r, status: accept ? 'accepted' : 'declined', since: today() } : r)) });
          if (!accept) return;
          const def = RETOS[id];
          const kind = def.routine;
          const base = get().routines[kind] ?? defaultRoutine(kind, get().profile.areas.map((a) => a.id));
          const step = { id: retoStepId(id), text: retoText(id, reto.n), minutes: def.minutes };
          get().setRoutine(kind, { ...base, enabled: true, steps: [...base.steps.filter((s) => s.id !== step.id), step] });
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
              // A finished onboarding on any device counts.
              profile: get().profile.onboarded ? get().profile : { ...EMPTY_PROFILE, ...(remote.profile ?? get().profile) },
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
      version: 6,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, streak, tasks, lastDay, history, owner, learned, focus, goals, routines, routineLog, profile, focusLog, retos, weekPlannedOn, nudges }) => ({
        goals,
        weekPlannedOn,
        nudges,
        retos,
        focusLog,
        profile,
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
            retos: s.retos ?? [],
            focusLog: s.focusLog ?? {},
            profile: { ...EMPTY_PROFILE, ...((s.profile as Partial<Profile>) ?? {}) },
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

/** "20 abdominales antes de dormir" in the person's language. */
export function retoText(id: RetoId, n: number) {
  return t(`reto.${id}`, { n });
}
