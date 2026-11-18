import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { tasksDoneBy, type Activity, type ActivityType } from './actividad';
import { todayIso, useDay } from '../store/day';

/**
 * Apple Health: today's steps and workouts tick sport tasks by themselves.
 * Only in builds with the HealthKit capability (paid Apple account): free-signing builds leave the module out.
 */
type HK = typeof import('@kingstinct/react-native-healthkit');

let hk: HK | null | undefined;
function lib(): HK | null {
  if (hk !== undefined) return hk;
  hk = null;
  if (Platform.OS !== 'ios' || !Constants.expoConfig?.extra?.health) return hk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hk = require('@kingstinct/react-native-healthkit') as HK;
  } catch (e) {
    console.warn('[salud] module missing', e);
  }
  return hk;
}

export const useSalud = create<{ on: boolean; steps: number; syncedAt: number | null }>()(
  persist(() => ({ on: false as boolean, steps: 0, syncedAt: null as number | null }), { name: 'okio-salud', storage: createJSONStorage(() => AsyncStorage) }),
);

export function healthAvailable(): boolean {
  const h = lib();
  try {
    return Boolean(h?.isHealthDataAvailable());
  } catch {
    return false;
  }
}

const READ = ['HKQuantityTypeIdentifierStepCount', 'HKWorkoutTypeIdentifier'] as const;

export async function connectHealth(): Promise<boolean> {
  const h = lib();
  if (!h) return false;
  try {
    await h.requestAuthorization({ toRead: READ as never });
    useSalud.setState({ on: true });
    await syncHealth();
    return true;
  } catch (e) {
    console.warn('[salud] auth', e);
    return false;
  }
}

export function disconnectHealth() {
  useSalud.setState({ on: false });
}

const TYPE: Record<number, ActivityType> = { 37: 'run', 13: 'ride', 52: 'walk', 46: 'swim', 50: 'strength', 20: 'strength', 63: 'strength', 41: 'football' };

/** Read today and tick what it completes. Returns how many tasks were ticked. */
export async function syncHealth(): Promise<number> {
  const h = lib();
  if (!h || !useSalud.getState().on) return 0;
  const day = todayIso();
  const start = new Date(`${day}T00:00:00`);
  const filter = { date: { startDate: start, endDate: new Date() } };
  try {
    const stats = await h.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], { filter, unit: 'count' });
    const steps = Math.round(stats.sumQuantity?.quantity ?? 0);
    const workouts = await h.queryWorkoutSamples({ filter, limit: 0 });
    const activities: Activity[] = workouts.map((w) => {
      const d = w.duration;
      const minutes = d.unit === 's' ? d.quantity / 60 : d.unit === 'min' ? d.quantity : d.unit === 'hr' ? d.quantity * 60 : d.quantity / 60;
      return { type: TYPE[w.workoutActivityType as number] ?? 'other', minutes, day, source: 'health' };
    });
    useSalud.setState({ steps, syncedAt: Date.now() });
    const ids = tasksDoneBy(useDay.getState().tasks, activities, day, steps);
    for (const id of ids) useDay.getState().markDone(id);
    return ids.length;
  } catch (e) {
    console.warn('[salud] sync', e);
    return 0;
  }
}
