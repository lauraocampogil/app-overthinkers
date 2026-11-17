import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';

/** Last word on entitlements: some modules add theirs automatically, so strip the paid-only ones at the end. */
const withoutPaidEntitlements: ConfigPlugin = (cfg) =>
  withEntitlementsPlist(cfg, (c) => {
    for (const key of ['aps-environment', 'com.apple.developer.applesignin', 'com.apple.security.application-groups']) {
      delete c.modResults[key];
    }
    return c;
  });

/**
 * Builds on top of app.json.
 *
 * GETGO_FREE_SIGNING=1 → a build you can install on your own iPhone with a free Apple ID
 * (Xcode "Personal Team"). Free teams can't sign some capabilities, so this build leaves out:
 *   - Sign in with Apple (log in with Google instead),
 *   - the push entitlement (local reminders still work),
 *   - home-screen widgets (they need an App Group).
 * Store builds (paid Apple Developer account) use the full config.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.GETGO_FREE_SIGNING !== '1') return base;

  const skip = new Set(['expo-notifications', 'expo-widgets', 'expo-apple-authentication']);
  const name = (p: unknown) => (Array.isArray(p) ? p[0] : p) as string;
  return withoutPaidEntitlements({
    ...base,
    ios: { ...base.ios, usesAppleSignIn: false },
    plugins: (base.plugins ?? []).filter((p) => !skip.has(name(p))),
  });
};
