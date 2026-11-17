import * as Notifications from 'expo-notifications';

import { t } from '../i18n';
import type { PlannedTask } from './types';

/**
 * Local reminders that help finish the list (no server needed):
 * - every morning at the person's time: "what's on your mind today?"
 * - today at 20:00, only if something is still pending: "you have N left".
 * They are rescheduled whenever the list changes.
 */

const MORNING_ID = 'getgo-morning';
const EVENING_ID = 'getgo-evening';
const EVENING_HOUR = 20;

let asked = false;

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
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function refreshReminders(opts: { plan: PlannedTask[]; isToday: boolean; notifyAt: string }) {
  try {
    if (!(await ensureNotificationPermission())) return;

    // Morning nudge, every day.
    const [h, m] = opts.notifyAt.split(':').map(Number);
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: { title: t('notif.morningTitle'), body: t('notif.morningBody') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h || 8, minute: m || 0 },
    });

    // Evening nudge, only today and only if there is something left.
    await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
    const pending = opts.isToday ? opts.plan.filter((x) => x.status === 'pendiente') : [];
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
  } catch (e) {
    console.warn('[avisos]', e);
  }
}
