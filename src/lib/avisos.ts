import * as Notifications from 'expo-notifications';

import { t } from '../i18n';
import type { Routine, RoutineKind, Task } from './types';

/**
 * Local reminders (no server needed). A task's reminder keeps coming back until the task is really done:
 * iOS doesn't let an app make a notification that can't be swiped away, so GetGo re-sends it
 * every REPEAT_MIN minutes until it is ticked (or proven with a photo). Ticking it cancels the rest.
 * Also: the morning nudge, the evening "N left", and the morning / night routines.
 */

const MORNING_ID = 'getgo-morning';
const EVENING_ID = 'getgo-evening';
const TASK_PREFIX = 'getgo-task-';
const ROUTINE_PREFIX = 'getgo-routine-';
export const TASK_CATEGORY = 'getgo-task';
const EVENING_HOUR = 20;
const REPEAT_MIN = 30;
const MAX_PER_TASK = 6;
/** iOS keeps at most 64 scheduled notifications per app; leave room for the daily ones. */
const MAX_TASK_NOTIFS = 52;

let asked = false;
let categoryReady = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (asked || !current.canAskAgain) return false;
  asked = true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Buttons on a task reminder: "Hecho / foto" opens the app on the task, "In 15 min" snoozes. */
async function ensureCategory() {
  if (categoryReady) return;
  categoryReady = true;
  await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
    { identifier: 'done', buttonTitle: t('notif.actionDone'), options: { opensAppToForeground: true } },
    { identifier: 'snooze', buttonTitle: t('notif.actionSnooze'), options: { opensAppToForeground: false } },
  ]).catch(() => {});
}

export type TaskAlarm = { task: Task; start: Date };

async function cancelPrefix(prefix: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Removes a task's reminders, scheduled and already on screen (called when it is done). */
export async function clearTaskReminders(taskId: string) {
  try {
    await cancelPrefix(`${TASK_PREFIX}${taskId}-`);
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => n.request.identifier.startsWith(`${TASK_PREFIX}${taskId}-`))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch (e) {
    console.warn('[avisos] clear', e);
  }
}

export async function snoozeTask(task: { id: string; title: string; proof?: string | null }, minutes = 15) {
  await Notifications.scheduleNotificationAsync({
    identifier: `${TASK_PREFIX}${task.id}-snooze-${Date.now()}`,
    content: taskContent(task),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + minutes * 60_000) },
  });
}

function taskContent(task: { id: string; title: string; proof?: string | null; needsProof?: boolean }) {
  return {
    title: task.title,
    body: task.needsProof && task.proof ? t('notif.taskProofBody', { proof: task.proof }) : t('notif.taskBody'),
    categoryIdentifier: TASK_CATEGORY,
    interruptionLevel: 'timeSensitive' as const,
    data: { url: `getgo://prueba?id=${task.id}`, taskId: task.id },
  };
}

export async function refreshReminders(opts: {
  today: Task[];
  alarms: TaskAlarm[];
  notifyAt: string;
  dayEnd: string;
  routines: Record<RoutineKind, Routine>;
}) {
  try {
    if (!(await ensureNotificationPermission())) return;
    await ensureCategory();

    // Morning nudge, every day.
    const [h, m] = opts.notifyAt.split(':').map(Number);
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: { title: t('notif.morningTitle'), body: t('notif.morningBody') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h || 8, minute: m || 0 },
    });

    // Routines, every day at their time.
    await cancelPrefix(ROUTINE_PREFIX);
    for (const kind of ['manana', 'noche'] as const) {
      const r = opts.routines[kind];
      if (!r.enabled || !r.steps.length) continue;
      const [rh, rm] = r.at.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        identifier: `${ROUTINE_PREFIX}${kind}`,
        content: {
          title: t(`routine.notif.${kind}`),
          body: r.steps.map((s) => s.text).slice(0, 3).join(' · '),
          data: { url: `getgo://rutina?kind=${kind}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: rh || 0, minute: rm || 0 },
      });
    }

    // Task reminders: at the start, then again and again until it is done.
    await cancelPrefix(TASK_PREFIX);
    const [eh, em] = opts.dayEnd.split(':').map(Number);
    const end = new Date();
    end.setHours(eh || 22, em || 0, 0, 0);
    let budget = MAX_TASK_NOTIFS;
    const now = Date.now();
    for (const { task, start } of opts.alarms) {
      if (task.status !== 'pendiente') continue;
      // Always the next MAX_PER_TASK reminders from now on (re-planned each time the app opens).
      let sent = 0;
      for (let i = 0; sent < MAX_PER_TASK && budget > 0; i++) {
        const at = new Date(start.getTime() + i * REPEAT_MIN * 60_000);
        if (at.getTime() <= now + 5_000) continue;
        if (at > end) break;
        budget--;
        sent++;
        await Notifications.scheduleNotificationAsync({
          identifier: `${TASK_PREFIX}${task.id}-${i}`,
          content: { ...taskContent(task), ...(i > 0 ? { subtitle: t('notif.stillOpen') } : {}) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    }

    // Reminders already on screen for tasks that are done now: take them away.
    const open = new Set(opts.today.filter((x) => x.status === 'pendiente').map((x) => x.id));
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => n.request.identifier.startsWith(TASK_PREFIX))
        .filter((n) => !open.has(String(n.request.content.data?.taskId ?? '')))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );

    // Evening nudge, only today and only if there is something left.
    await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
    const pending = opts.today.filter((x) => x.status === 'pendiente');
    const at = new Date();
    at.setHours(EVENING_HOUR, 0, 0, 0);
    if (pending.length && at.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        identifier: EVENING_ID,
        content: {
          title: t('notif.eveningTitle', { n: pending.length }),
          body: t('notif.eveningBody', { title: pending[0].title }),
          data: { url: 'getgo://' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
    await Notifications.setBadgeCountAsync(pending.length).catch(() => {});
  } catch (e) {
    console.warn('[avisos]', e);
  }
}
