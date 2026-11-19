import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { TurboModuleRegistry } from 'react-native';
import { create } from 'zustand';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type AuthState = { session: Session | null; ready: boolean };

/** Current Supabase session. `ready` is false until the stored session has been read. */
export const useAuth = create<AuthState>(() => ({ session: null, ready: !supabase }));

if (supabase) {
  supabase.auth.getSession().then(({ data }) => useAuth.setState({ session: data.session, ready: true }));
  supabase.auth.onAuthStateChange((_event, session) => useAuth.setState({ session, ready: true }));
}

export type AuthResult = 'ok' | 'cancelled' | 'failed' | 'noServer';

/** Where Google sends the user back: getgo://auth in a build, exp://…/--/auth in Expo Go. */
export const redirectTo = Linking.createURL('auth');

/**
 * Native Google sign-in (system sheet that says "GetGo", no supabase.co domain).
 * Needs a development / store build and the Google client IDs in .env; otherwise the web flow below is used.
 */
const GOOGLE_IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
type GoogleSdk = typeof import('@react-native-google-signin/google-signin');
let google: GoogleSdk | null = null;
if (GOOGLE_WEB && TurboModuleRegistry.get('RNGoogleSignin')) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('@react-native-google-signin/google-signin') as GoogleSdk;
    google.GoogleSignin.configure({ iosClientId: GOOGLE_IOS, webClientId: GOOGLE_WEB });
  } catch (e) {
    console.warn('[auth] native google unavailable', e);
    google = null;
  }
}

async function signInWithGoogleNative(sdk: GoogleSdk): Promise<AuthResult> {
  if (!supabase) return 'noServer';
  try {
    await sdk.GoogleSignin.hasPlayServices();
    const res = await sdk.GoogleSignin.signIn();
    if (res.type !== 'success') return 'cancelled';
    const token = res.data.idToken;
    if (!token) return 'failed';
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if (sdk.isErrorWithCode(e) && e.code === sdk.statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
    console.warn('[auth] native google failed', e);
    return 'failed';
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return 'noServer';
  if (google) return signInWithGoogleNative(google);
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data?.url) throw error ?? new Error('no url');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return 'cancelled';
    const { queryParams } = Linking.parse(result.url);
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (!code) {
      console.warn('[auth] google returned without code', queryParams?.error_description ?? queryParams?.error);
      return 'failed';
    }
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return 'ok';
  } catch (e) {
    console.warn('[auth] google failed', e);
    return 'failed';
  }
}

/** Native Sign in with Apple (iOS). Apple only shares name/email the first time. */
export async function signInWithApple(): Promise<AuthResult> {
  if (!supabase) return 'noServer';
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return 'failed';
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) throw error;
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name) await supabase.auth.updateUser({ data: { full_name: name } });
    return 'ok';
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    console.warn('[auth] apple failed', e);
    return 'failed';
  }
}

export async function signOut() {
  await google?.GoogleSignin.signOut().catch(() => null);
  await supabase?.auth.signOut();
}

/** Deletes the account and all its data on the server (required by the App Store), then signs out. */
export async function deleteAccount(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    console.warn('[auth] delete failed', error);
    return false;
  }
  await supabase.auth.signOut();
  return true;
}

export const MASCOT_AFTER_DAYS = 7;

/**
 * The halo turns into the person's own mascot one week after the account was created.
 * EXPO_PUBLIC_MASCOT_PREVIEW=1 in .env shows it straight away (for design reviews).
 */
export function useMascot() {
  const user = useAuth((s) => s.session?.user);
  const created = user?.created_at ? new Date(user.created_at).getTime() : Date.now();
  const days = Math.floor((Date.now() - created) / 86_400_000);
  const preview = process.env.EXPO_PUBLIC_MASCOT_PREVIEW === '1';
  return {
    seed: user?.id ?? 'getgo',
    // Okio is always there now: it starts grey and gains colour with the bond (lib/vinculo).
    unlocked: true,
    preview,
    daysLeft: Math.max(0, MASCOT_AFTER_DAYS - days),
    days,
    createdAt: created,
  };
}
