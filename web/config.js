// Okio web: where the waitlist is saved (your Supabase project).
// Both values are public by design (the same ones the app ships with: EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_ANON_KEY). The waitlist table only accepts new rows; nobody can read it from the web.
window.OKIO_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
