import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** null when the env vars are missing: the app then runs fully offline with the local planner. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

/** Anonymous account so data syncs without asking for sign-up on day one. */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[supabase] anonymous sign-in failed', error.message);
    return null;
  }
  return anon.user?.id ?? null;
}
