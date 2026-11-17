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
};

/** A task in the list. GetGo assigns it a day; the person can pin it to another one. */
export type Task = Omit<RawTask, 'dueInDays'> & {
  id: string;
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
};

/** Kept as an alias so older imports keep compiling. */
export type PlannedTask = Task;

export type Settings = {
  level: Level;
  /** Free minutes per day (kept for the server schema; the planner no longer fills by time). */
  freeMinutes: number;
  notifyAt: string;
};

export type Streak = {
  current: number;
  best: number;
  freezes: number;
  /** ISO date (yyyy-mm-dd) of the last day that counted. */
  lastCountedDate: string | null;
};

export type ParseResult = { tasks: RawTask[]; tired: boolean };
