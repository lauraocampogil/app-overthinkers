import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { t } from '@/i18n';

/**
 * Blocking distracting apps (social media, games…) while a focus session runs, with Apple's Screen Time API.
 * The person chooses the apps once in Apple's own picker (GetGo never sees which ones: Apple only gives a token).
 * Needs a build with the Family Controls entitlement (paid Apple account + Apple's approval): in other builds
 * `blockingAvailable()` is false and everything here does nothing. Calls and emergency calls are never blocked.
 */
export const SELECTION_ID = 'getgo-focus';

/** The person's choice: block during focus or not, and whether apps were picked (Apple keeps the list itself). */
export const useBloqueo = create<{ enabled: boolean; picked: number }>()(
  persist(() => ({ enabled: false as boolean, picked: 0 }), { name: 'getgo-bloqueo', storage: createJSONStorage(() => AsyncStorage) }),
);

type Lib = typeof import('react-native-device-activity');
let lib: Lib | null = null;
function load(): Lib | null {
  if (lib) return lib;
  // Only builds made with the entitlement (APPLE_TEAM_ID set, see app.config.ts) can really block.
  const enabledInBuild = Boolean((Constants.expoConfig?.extra as { appBlocking?: boolean } | undefined)?.appBlocking);
  if (Platform.OS !== 'ios' || !enabledInBuild || !requireOptionalNativeModule('ReactNativeDeviceActivity')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('react-native-device-activity') as Lib;
    return lib;
  } catch {
    return null;
  }
}

export const blockingAvailable = () => !!load()?.isAvailable();
export const blockingLib = () => load();

/** Ask iOS for Screen Time permission (system sheet). true when granted. */
export async function askBlockingPermission(): Promise<boolean> {
  const l = load();
  if (!l) return false;
  try {
    await l.requestAuthorization('individual');
  } catch {
    return false;
  }
  return l.getAuthorizationStatus() === l.AuthorizationStatus.approved;
}

export function blockingAuthorized(): boolean {
  const l = load();
  return !!l && l.getAuthorizationStatus() === l.AuthorizationStatus.approved;
}

/** Shield shown when a blocked app is opened during focus: GetGo's words, one button to go back. */
function shield(l: Lib) {
  l.updateShield(
    {
      title: t('block.shieldTitle'),
      subtitle: t('block.shieldBody'),
      primaryButtonLabel: t('block.shieldButton'),
      iconSystemName: 'timer',
      backgroundColor: { red: 255, green: 255, blue: 255 },
      titleColor: { red: 10, green: 10, blue: 10 },
      subtitleColor: { red: 110, green: 110, blue: 110 },
      primaryButtonBackgroundColor: { red: 10, green: 10, blue: 10 },
      primaryButtonLabelColor: { red: 255, green: 255, blue: 255 },
    },
    { primary: { behavior: 'close' } },
  );
}

/** Start blocking the chosen apps (called when a focus session starts or resumes). */
export function blockForFocus(): boolean {
  const l = load();
  const { enabled, picked } = useBloqueo.getState();
  if (!l || !enabled || !picked || !blockingAuthorized()) return false;
  try {
    shield(l);
    l.blockSelection({ activitySelectionId: SELECTION_ID }, 'focus-start');
    return true;
  } catch (e) {
    console.warn('[bloqueo] block', e);
    return false;
  }
}

/** Lift every block (focus ended, cancelled, or the app starts with no focus running). */
export function unblockAll() {
  const l = load();
  if (!l) return;
  try {
    l.resetBlocks('focus-end');
  } catch (e) {
    console.warn('[bloqueo] unblock', e);
  }
}
