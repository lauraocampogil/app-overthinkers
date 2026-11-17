import { requireOptionalNativeModule } from 'expo';

import { t } from '../i18n';
import { mascotTraits } from '../components/Mascota';
import type { Task } from './types';
import type { WidgetProps } from '../widgets/GetGoWidget';

/**
 * Keeps the home-screen widget in step with today's list, and brings back the ticks made on the widget.
 * Widgets only exist in a development / store build; in Expo Go every call here is a no-op.
 */
type WidgetApi = {
  updateSnapshot: (p: WidgetProps) => void;
  getTimeline: () => Promise<{ date: Date; props: WidgetProps }[]>;
};

let widget: WidgetApi | null = null;
if (requireOptionalNativeModule('ExpoWidgets')) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widget = require('../widgets/GetGoWidget').default as WidgetApi;
  } catch (e) {
    console.warn('[widget] not available', e);
  }
}

const BODY = 116; // mascot body diameter in the Mascota viewBox

export function syncWidget(opts: { today: Task[]; seed: string }) {
  if (!widget) return;
  try {
    const list = opts.today;
    const pending = list.filter((x) => x.status === 'pendiente');
    const done = list.filter((x) => x.status === 'hecha');
    const tr = mascotTraits(opts.seed);
    widget.updateSnapshot({
      left: pending.length,
      total: list.length,
      tasks: [...pending, ...done].slice(0, 7).map((x) => ({ id: x.id, title: x.title, done: x.status === 'hecha' })),
      mascot: {
        core: tr.palette.core,
        mid: tr.palette.mid,
        edge: tr.palette.edge,
        eyeW: (tr.eyeW / BODY) * 100,
        eyeH: (tr.eyeH / BODY) * 100,
        gap: (tr.eyeGap / BODY) * 100,
      },
      text: {
        left: t('widget.left', { n: pending.length }),
        none: t('widget.none'),
        allDone: t('hoy.doneTitle'),
        empty: t('widget.empty'),
      },
    });
  } catch (e) {
    console.warn('[widget] update failed', e);
  }
}

/** Task ids ticked or unticked on the widget while the app was closed. */
export async function widgetChanges(): Promise<{ id: string; done: boolean }[]> {
  if (!widget) return [];
  try {
    const entries = await widget.getTimeline();
    const last = entries[entries.length - 1];
    return last ? last.props.tasks.map((x) => ({ id: x.id, done: x.done })) : [];
  } catch {
    return [];
  }
}
