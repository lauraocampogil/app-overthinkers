import { daysBetween } from './planner';
import { areaWeight, type Area } from './perfil';
import type { Task } from './types';

/**
 * "Lo más importante": every day GetGo shows only 3 tasks as the priority.
 * Stars set by the person come first; the rest is filled by a score.
 * The idea for overthinkers: if these 3 are done, the day counts, whatever else happens.
 */
export function priorityScore(task: Task, today: string, areas: Area[] = []) {
  let s = task.importance * 10;
  // What matters most to this person: their first area weighs most.
  s += areaWeight(task, areas) * 6;
  if (task.due) {
    const d = daysBetween(today, task.due);
    if (d <= 0) s += 12;
    else if (d === 1) s += 7;
    else if (d <= 3) s += 3;
  }
  if (task.goalId) s += 4; // moves a goal forward
  s += Math.min(task.postponed, 3) * 3; // pushed back before: time to face it
  if (task.at) s += 2; // fixed time: it will happen anyway
  return s;
}

export function topThree(today: Task[], day: string, areas: Area[] = []): Task[] {
  const pending = today.filter((t) => t.status === 'pendiente');
  const starred = pending.filter((t) => t.top);
  const rest = pending
    .filter((t) => !t.top)
    .sort((a, b) => priorityScore(b, day, areas) - priorityScore(a, day, areas));
  return [...starred, ...rest].slice(0, 3);
}

/** Done today among the top 3 shown this morning (starred ones that were finished still count). */
export function topDoneToday(tasks: Task[], day: string) {
  return tasks.filter((t) => t.status === 'hecha' && t.doneOn === day && t.top).length;
}

/** A task that must be proven with a photo before it can be ticked. */
export const requiresProof = (t: Task) => Boolean(t.needsProof) && !t.proofPhoto && t.status === 'pendiente';
