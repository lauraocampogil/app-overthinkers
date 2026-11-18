export type Level = 'suave' | 'equilibrado' | 'duro';
export type Energy = 'alta' | 'baja';
export type Kind = 'trabajo' | 'estudio' | 'deporte' | 'casa' | 'otro';

/** A task as understood from the brain dump (by the AI or the local parser). */
export type RawTask = {
  title: string;
  /** Only when the person said how long it takes ("1 h de gym"). GetGo never invents durations. */
  minutes: number | null;
  /** Days until it is due (0 = today). null when there is no deadline. */
  dueInDays: number | null;
  energy: Energy;
  kind: Kind;
  /** 3 = important, 2 = normal, 1 = can wait. */
  importance: 1 | 2 | 3;
  /** Sport-specific hint so the planner can apply "strength before cardio". */
  sport?: 'fuerza' | 'cardio' | null;
  /** Things to tick inside the task: shopping items, exercises, steps… */
  checklist?: string[];
  /** Where it happens, if said ("Basic-Fit Ixelles"). */
  where?: string | null;
  /** Fixed time of day, if said ("a las 18:00" → "18:00"). */
  at?: string | null;
  /** Title of the goal this task belongs to, if any (matched to a Goal when added). */
  goal?: string | null;
  /** What photo proves it is done ("Foto de la compra"). null = nothing visible to photograph. */
  proof?: string | null;
};

/** A goal the person wants to reach. GetGo breaks it into tasks and keeps them on the calendar. */
export type Goal = {
  id: string;
  title: string;
  /** pronto = has a deadline, semanal = repeats every week, largo = long term without a near date. */
  type: 'pronto' | 'semanal' | 'largo';
  /** Deadline (ISO date) for "pronto" / "largo" goals. */
  due: string | null;
  /** For weekly goals: how many times per week ("gym 3 veces"). */
  perWeek: number | null;
  /** Details for the tasks a weekly goal creates (minutes, where, at, kind…). */
  template?: Partial<Pick<RawTask, 'minutes' | 'kind' | 'energy' | 'sport' | 'where' | 'at' | 'checklist'>> & { title?: string };
  createdOn: string;
  archived?: boolean;
  /** How it will look and feel when it's reached, in the person's words (visualisation). */
  vision?: string;
  /** Weekly check-ins: a measurement (weight in kg…) and/or a progress photo. */
  checkins?: Checkin[];
};

export type Checkin = { date: string; value?: number; photo?: string };

export type RawGoal = {
  title: string;
  type: Goal['type'];
  dueInDays: number | null;
  perWeek: number | null;
  /** Concrete steps to get there (for pronto / largo goals). */
  steps: RawTask[];
  template?: Goal['template'];
};

/** A task in the list. GetGo assigns it a day; the person can pin it to another one. */
export type ChecklistItem = { id: string; text: string; done: boolean };

export type Task = Omit<RawTask, 'dueInDays' | 'checklist' | 'goal'> & {
  id: string;
  checklist: ChecklistItem[];
  goalId: string | null;
  /** Deadline as an ISO date (yyyy-mm-dd), or null. */
  due: string | null;
  /** Day it is planned for (ISO date). */
  day: string;
  /** True when the person moved it by hand: the planner then keeps that day. */
  pinned: boolean;
  /** How many times this task has been pushed to another day. */
  postponed: number;
  status: 'pendiente' | 'hecha';
  /** Day it was completed (ISO date). */
  doneOn?: string;
  /** i18n keys (why.*) explaining why it is in this position. */
  why: string[];
  /** Starred by the person as one of today's 3 most important. */
  top?: boolean;
  /** Proof requested before it can be ticked (true when `proof` is set; the person can switch it off). */
  needsProof?: boolean;
  /** Local photo that proved it (file uri), and whether the AI could check it. */
  proofPhoto?: string;
  proofOffline?: boolean;
  /** Comes from the person's fixed week (football training every Tue/Thu…): id of that item. */
  fixedId?: string;
};

/** Morning or night routine: a fixed sequence the person runs through every day. */
export type RoutineStep = { id: string; text: string; minutes: number };
export type Routine = { enabled: boolean; at: string; steps: RoutineStep[] };
export type RoutineKind = 'manana' | 'noche';

/** Kept as an alias so older imports keep compiling. */
export type PlannedTask = Task;

export type Settings = {
  level: Level;
  /** Free minutes per day (kept for the server schema; the planner no longer fills by time). */
  freeMinutes: number;
  notifyAt: string;
  /** Calendar connection: off, read your events, or read + write GetGo's blocks. */
  calendar: 'off' | 'read' | 'write';
  /** Calendar id GetGo writes its blocks into (any calendar on the phone: iCloud, Google, Outlook…). */
  calendarTarget: string | null;
  /** The part of the day GetGo may plan in (HH:MM). */
  dayStart: string;
  dayEnd: string;
};

export type Streak = {
  current: number;
  best: number;
  freezes: number;
  /** ISO date (yyyy-mm-dd) of the last day that counted. */
  lastCountedDate: string | null;
};

export type ParseResult = { tasks: RawTask[]; tired: boolean; goals?: RawGoal[] };
