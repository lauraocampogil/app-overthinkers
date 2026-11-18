import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

/**
 * Crash and error reporting (Sentry) and subscriptions (RevenueCat).
 * Both turn on only when their keys are in .env and the native modules are in the build,
 * so the app keeps working in Expo Go or before the accounts exist.
 *
 *   EXPO_PUBLIC_SENTRY_DSN=https://…@….ingest.sentry.io/…
 *   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…
 *   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
 */
const has = (name: string) => {
  try {
    return Boolean(TurboModuleRegistry.get(name) ?? (NativeModules as Record<string, unknown>)[name]);
  } catch {
    return false;
  }
};

type SentryApi = typeof import('@sentry/react-native');
let sentry: SentryApi | null = null;

export function initMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || !has('RNSentry')) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/react-native') as SentryApi;
    sentry.init({
      dsn,
      // Only errors and performance: no screen recordings, no personal data.
      sendDefaultPii: false,
      tracesSampleRate: 0.2,
      environment: __DEV__ ? 'development' : 'production',
    });
  } catch (e) {
    console.warn('[monitor] sentry', e);
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  console.warn('[error]', error, context ?? '');
  try {
    sentry?.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // never let reporting break the app
  }
}

export function identifyUser(id: string | null) {
  try {
    sentry?.setUser(id ? { id } : null);
  } catch {
    // ignore
  }
  void identifyPurchases(id);
}

type PurchasesApi = typeof import('react-native-purchases').default;
let purchases: PurchasesApi | null = null;

export function initPurchases() {
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!key || !has('RNPurchases')) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchases = (require('react-native-purchases') as { default: PurchasesApi }).default;
    purchases.configure({ apiKey: key });
  } catch (e) {
    console.warn('[monitor] purchases', e);
  }
}

async function identifyPurchases(id: string | null) {
  if (!purchases) return;
  try {
    if (id) await purchases.logIn(id);
    else await purchases.logOut();
  } catch {
    // anonymous user or offline
  }
}

/** True when the person has the "pro" entitlement in RevenueCat. False when RevenueCat isn't set up. */
export async function hasPro(): Promise<boolean> {
  if (!purchases) return false;
  try {
    const info = await purchases.getCustomerInfo();
    return Boolean(info.entitlements.active.pro);
  } catch {
    return false;
  }
}

/** A plan as the paywall shows it. Prices come from the store via RevenueCat. */
export type Plan = {
  id: string;
  kind: 'annual' | 'monthly';
  price: string;
  /** Monthly equivalent, for the annual plan ("3,33 €/mes"). */
  perMonth: string | null;
  /** Free trial length in days, if the store offers one. */
  trialDays: number | null;
  /** Monthly price as a number, to show how much the annual plan saves. */
  amount: number;
};

/** The current offering's annual and monthly plans. Empty when RevenueCat is not set up or offline. */
export async function getPlans(): Promise<Plan[]> {
  if (!purchases) return [];
  try {
    const offerings = await purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    return pkgs
      .filter((p) => p.packageType === 'ANNUAL' || p.packageType === 'MONTHLY')
      .map((p) => {
        const intro = p.product.introPrice;
        const unitDays: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
        const trialDays = intro && intro.price === 0 ? (unitDays[intro.periodUnit] ?? 0) * (intro.periodNumberOfUnits ?? 1) * (intro.cycles || 1) : null;
        const annual = p.packageType === 'ANNUAL';
        return { id: p.identifier, kind: annual ? 'annual' : 'monthly', price: p.product.priceString, perMonth: annual ? p.product.pricePerMonthString : null, trialDays, amount: annual ? p.product.price / 12 : p.product.price } as Plan;
      })
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'annual' ? -1 : 1));
  } catch (e) {
    console.warn('[monitor] offerings', e);
    return [];
  }
}

/** Buy a plan. true when "pro" is active afterwards; false when cancelled or failed. */
export async function buyPlan(id: string): Promise<boolean> {
  if (!purchases) return false;
  try {
    const offerings = await purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) => p.identifier === id);
    if (!pkg) return false;
    const { customerInfo } = await purchases.purchasePackage(pkg);
    return Boolean(customerInfo.entitlements.active.pro);
  } catch (e) {
    const cancelled = (e as { userCancelled?: boolean }).userCancelled;
    if (!cancelled) reportError(e, { where: 'buyPlan' });
    return false;
  }
}

export async function restorePlan(): Promise<boolean> {
  if (!purchases) return false;
  try {
    const info = await purchases.restorePurchases();
    return Boolean(info.entitlements.active.pro);
  } catch {
    return false;
  }
}

export const purchasesReady = () => purchases !== null;
