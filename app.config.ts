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
/** Native Google sign-in needs the reversed iOS client ID as a URL scheme. Only added when the ID is set. */
function withGoogle(cfg: ExpoConfig): ExpoConfig {
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!ios) return cfg;
  const iosUrlScheme = `com.googleusercontent.apps.${ios.replace('.apps.googleusercontent.com', '')}`;
  return { ...cfg, plugins: [...(cfg.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]] };
}

/**
 * Blocking apps during a focus session (Screen Time / Family Controls). Only with a paid Apple account,
 * the Family Controls entitlement approved by Apple, and APPLE_TEAM_ID set: otherwise the build would fail to sign.
 * Adds the ActivityMonitor, ShieldAction and ShieldConfiguration extensions.
 */
function withBlocking(cfg: ExpoConfig): ExpoConfig {
  const team = process.env.APPLE_TEAM_ID;
  if (!team || process.env.GETGO_FREE_SIGNING === '1') return cfg;
  const bundle = cfg.ios?.bundleIdentifier ?? 'com.unixcreative.getgo';
  return {
    ...cfg,
    ios: { ...cfg.ios, appleTeamId: team },
    extra: { ...cfg.extra, appBlocking: true },
    plugins: [...(cfg.plugins ?? []), ['react-native-device-activity', { appleTeamId: team, appGroup: `group.${bundle}` }]],
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = withBlocking(withGoogle(config as ExpoConfig));
  if (process.env.GETGO_FREE_SIGNING !== '1') return base;

  const skip = new Set(['expo-notifications', 'expo-widgets', 'expo-apple-authentication']);
  const name = (p: unknown) => (Array.isArray(p) ? p[0] : p) as string;
  return withoutPaidEntitlements({
    ...base,
    extra: { ...base.extra, appleSignIn: false },
    ios: { ...base.ios, usesAppleSignIn: false },
    plugins: (base.plugins ?? []).filter((p) => !skip.has(name(p))),
  });
};
