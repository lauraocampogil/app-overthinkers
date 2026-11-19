import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Travel time: an overwhelmed day is often a day that forgot the commute.
 * The person saves where they live and how they move; every task with a place gets its travel time
 * (from home), the planner keeps that time free before it, and the reminder says when to leave.
 * Estimates only, from the distance (no maps service, no cost): honest about being approximate.
 */
export type Point = { lat: number; lng: number };
export type Mode = 'pie' | 'bici' | 'transporte' | 'coche';
export const MODES: Mode[] = ['pie', 'bici', 'transporte', 'coche'];

/** Average door-to-door speeds in a city (km/h) and fixed minutes (waiting, parking, walking to the stop). */
const SPEED: Record<Mode, number> = { pie: 4.8, bici: 14, transporte: 17, coche: 24 };
const FIXED: Record<Mode, number> = { pie: 0, bici: 3, transporte: 8, coche: 6 };
/** Streets are not straight lines. */
const DETOUR = 1.35;

export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Minutes from a to b, rounded up to 5. 0 when it is next door (under 300 m). Pure, tested. */
export function travelMinutes(a: Point, b: Point, mode: Mode): number {
  const km = distanceKm(a, b) * DETOUR;
  if (km < 0.3) return 0;
  const raw = (km / SPEED[mode]) * 60 + FIXED[mode];
  return Math.max(5, Math.ceil(raw / 5) * 5);
}

/** When to leave for something at `at` (HH:MM), with 5 minutes of margin. */
export function leaveAt(at: string, minutes: number): string {
  const [h, m] = at.split(':').map(Number);
  const total = h * 60 + m - minutes - 5;
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Addresses already looked up (null = not found), so each place is geocoded once. */
export const useLugares = create<{ cache: Record<string, Point | null> }>()(
  persist(() => ({ cache: {} as Record<string, Point | null> }), { name: 'okio-places', storage: createJSONStorage(() => AsyncStorage) }),
);

const key = (address: string) => address.trim().toLowerCase();

type Loc = typeof import('expo-location');
let loc: Loc | null | undefined;
function lib(): Loc | null {
  if (loc !== undefined) return loc;
  loc = null;
  if (!requireOptionalNativeModule('ExpoLocation')) return loc;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loc = require('expo-location') as Loc;
  } catch {
    loc = null;
  }
  return loc;
}

export const placesAvailable = () => lib() !== null;

/** Android needs location permission to geocode; iOS does not. */
async function canGeocode(l: Loc): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const cur = await l.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  return (await l.requestForegroundPermissionsAsync()).granted;
}

/** Address → point, using the phone's own geocoder (free). Cached. */
export async function geocode(address: string): Promise<Point | null> {
  const k = key(address);
  if (!k) return null;
  const cache = useLugares.getState().cache;
  if (k in cache) return cache[k];
  const l = lib();
  if (!l || !(await canGeocode(l))) return null;
  try {
    const [hit] = await l.geocodeAsync(address);
    const p = hit ? { lat: hit.latitude, lng: hit.longitude } : null;
    useLugares.setState({ cache: { ...useLugares.getState().cache, [k]: p } });
    return p;
  } catch {
    return null;
  }
}

/** Where the phone is now, to save "home" with one tap. Asks for permission. */
export async function hereNow(): Promise<{ point: Point; label: string } | null> {
  const l = lib();
  if (!l) return null;
  try {
    const perm = await l.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await l.getCurrentPositionAsync({ accuracy: l.Accuracy.Balanced });
    const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const [a] = await l.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lng }).catch(() => []);
    const label = a ? [a.street && `${a.street}${a.streetNumber ? ` ${a.streetNumber}` : ''}`, a.city].filter(Boolean).join(', ') : '';
    return { point, label };
  } catch {
    return null;
  }
}

/** Travel minutes to a place from home, if both are known (cached lookups only: never waits). */
export function travelTo(where: string | null | undefined, home: Point | null | undefined, mode: Mode | undefined): number | null {
  if (!where || !home) return null;
  const p = useLugares.getState().cache[key(where)];
  if (!p) return null;
  return travelMinutes(home, p, mode ?? 'transporte');
}

/** Look up the places of upcoming tasks in the background (a few at a time). */
export async function warmPlaces(addresses: (string | null | undefined)[]) {
  const cache = useLugares.getState().cache;
  const todo = [...new Set(addresses.filter((a): a is string => !!a && !(key(a) in cache)))].slice(0, 5);
  for (const a of todo) await geocode(a);
}
