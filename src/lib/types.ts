export type Level = 'suave' | 'equilibrado' | 'duro';
export type Energy = 'alta' | 'baja';
export type Kind = 'trabajo' | 'estudio' | 'deporte' | 'casa' | 'otro';

/** A task as understood from the brain dump (by the AI or the local parser). */
export type RawTask = {
  title: string;
  minutes: number;
  /** Days until it is due (0 = today). null when there is no deadline. */
  dueInDays: number | null;
  energy: Energy;
  kind: Kind;
  /** 3 = important, 2 = normal, 1 = can wait. */
  importance: 1 | 2 | 3;
  /** Sport-specific hint so the planner can apply "strength before cardio". */
  sport?: 'fuerza' | 'cardio' | null;
};

export type Task = RawTask & {
  id: string;
  /** How many times this task has been pushed to another day. */
  postponed: number;
};

export type PlannedTask = Task & {
  /** i18n keys (why.*) explaining why it is in this position. */
  why: string[];
  status: 'pendiente' | 'hecha' | 'quitada';
};

export type Settings = {
  level: Level;
  /** Free minutes per day the person said they have. */
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
