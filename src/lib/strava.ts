import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { tasksDoneBy, type Activity, type ActivityType } from './actividad';
import { ensureSession, supabase } from './supabase';
import { todayIso, useDay } from '../store/day';

/**
 * Strava: running, cycling, gym… logged on Strava tick the matching tasks in Okio.
 * OAuth happens in the system browser; the code is swapped for tokens on the server (edge function "strava"),
 * so the client secret never ships in the app.
 *
 * Strava app settings (strava.com/settings/api): "Authorization Callback Domain" = okio.app.
 */
const CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
const REDIRECT = 'okio://okio.app/strava';

export const useStrava = create<{ on: boolean; syncedAt: number | null; last: string }>()(
  persist(() => ({ on: false as boolean, syncedAt: null as number | null, last: '' }), { name: 'okio-strava', storage: createJSONStorage(() => AsyncStorage) }),
);

export const stravaAvailable = () => Boolean(CLIENT_ID && supabase);

export async function connectStrava(): Promise<boolean> {
  if (!stravaAvailable()) return false;
  const base = Platform.OS === 'ios' || Platform.OS === 'android' ? 'https://www.strava.com/oauth/mobile/authorize' : 'https://www.strava.com/oauth/authorize';
  const url = `${base}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&approval_prompt=auto&scope=activity:read`;
  try {
    const res = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
    if (res.type !== 'success') return false;
    const code = new URL(res.url).searchParams.get('code');
    if (!code) return false;
    await ensureSession();
    const { error } = await supabase!.functions.invoke('strava', { body: { action: 'exchange', code } });
    if (error) throw error;
    useStrava.setState({ on: true });
    await syncStrava();
    return true;
  } catch (e) {
    console.warn('[strava] connect', e);
    return false;
  }
}

export async function disconnectStrava() {
  useStrava.setState({ on: false });
  try {
    await ensureSession();
    await supabase?.functions.invoke('strava', { body: { action: 'disconnect' } });
  } catch (e) {
    console.warn('[strava] disconnect', e);
  }
}

const TYPE = (sport: string): ActivityType => {
  const s = sport.toLowerCase();
  if (s.includes('run')) return 'run';
  if (s.includes('ride') || s.includes('cycl')) return 'ride';
  if (s.includes('walk') || s.includes('hike')) return 'walk';
  if (s.includes('swim')) return 'swim';
  if (s.includes('weight') || s.includes('crossfit') || s.includes('hiit') || s.includes('workout')) return 'strength';
  if (s.includes('soccer') || s.includes('football')) return 'football';
  return 'other';
};

/** Fetch today's Strava activities and tick what they complete. Returns how many tasks were ticked. */
export async function syncStrava(): Promise<number> {
  if (!useStrava.getState().on || !supabase) return 0;
  const day = todayIso();
  const after = Math.floor(new Date(`${day}T00:00:00`).getTime() / 1000);
  try {
    await ensureSession();
    const { data, error } = await supabase.functions.invoke('strava', { body: { action: 'activities', after } });
    if (error) throw error;
    const list = (Array.isArray(data?.activities) ? data.activities : []) as { sport: string; minutes: number; km: number; day: string; name: string }[];
    const activities: Activity[] = list.map((a) => ({ type: TYPE(a.sport), minutes: a.minutes, km: a.km, day: a.day || day, source: 'strava' }));
    useStrava.setState({ syncedAt: Date.now(), last: list[0]?.name ?? useStrava.getState().last });
    const ids = tasksDoneBy(useDay.getState().tasks, activities, day);
    for (const id of ids) useDay.getState().markDone(id);
    return ids.length;
  } catch (e) {
    console.warn('[strava] sync', e);
    return 0;
  }
}
