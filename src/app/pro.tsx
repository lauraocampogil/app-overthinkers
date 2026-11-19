import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { CalendarIcon, CameraIcon, TargetIcon } from '@/components/Iconos';
import { Logo } from '@/components/Logo';
import { CheckIcon, CloseIcon, IconCircle, MicIcon, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { openPage, SITE_URL } from '@/lib/legal';
import { buyPlan, getPlans, purchasesReady, restorePlan, type Plan } from '@/lib/monitor';
import { track } from '@/lib/eventos';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

/**
 * Placeholder plans, only while RevenueCat is not configured (development).
 * The real prices always come from App Store / Google Play through RevenueCat.
 */
const FALLBACK: Plan[] = [
  { id: 'annual', kind: 'annual', price: '29,99 €', perMonth: '2,50 €', trialDays: 14, amount: 2.5 },
  { id: 'monthly', kind: 'monthly', price: '4,99 €', perMonth: null, trialDays: null, amount: 4.99 },
];

/** Paywall: shown once at the end of onboarding, and from Cuenta. It can always be closed. */
export default function Pro() {
  const { next, reason } = useLocalSearchParams<{ next?: string; reason?: string }>();
  const voz = useVoz();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const live = purchasesReady();

  useEffect(() => track('paywall', { reason: reason ?? next ?? 'account' }), [reason, next]);
  useEffect(() => {
    void getPlans().then((p) => {
      const list = p.length ? p : FALLBACK;
      setPlans(list);
      setPick(list[0].id);
    });
  }, []);

  const leave = () => (next === 'ordenando' ? router.replace('/ordenando') : router.back());
  // Closed without buying after the daily limit: back home (the dump stays saved as a draft).
  const close = () => (reason === 'limit' ? router.replace('/') : leave());
  const plan = plans?.find((p) => p.id === pick) ?? null;
  const monthly = plans?.find((p) => p.kind === 'monthly');
  const save = (p: Plan) => (p.kind === 'annual' && monthly ? Math.round((1 - p.amount / monthly.amount) * 100) : 0);

  const buy = async () => {
    if (!plan) return;
    if (!live) return leave(); // development without RevenueCat: just continue
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const ok = await buyPlan(plan.id);
    setBusy(false);
    if (ok) track('purchase', { plan: plan.kind });
    if (ok) leave();
  };
  const restore = async () => {
    setBusy(true);
    const ok = await restorePlan();
    setBusy(false);
    if (ok) leave();
    else setNote(t('pro.nothingToRestore'));
  };

  const perks = [
    { icon: <MicIcon color={colors.ink} />, title: t('pro.perk1'), body: t('pro.perk1Body') },
    { icon: <CalendarIcon size={22} />, title: t('pro.perk2'), body: t('pro.perk2Body') },
    { icon: <CameraIcon size={22} />, title: t('pro.perk3'), body: t('pro.perk3Body') },
    { icon: <TargetIcon size={22} />, title: t('pro.perk4'), body: t('pro.perk4Body') },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <Logo height={22} />
        <IconCircle label={t('common.close')} onPress={close}>
          <CloseIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.Text entering={FadeInDown.duration(450)} style={styles.title} accessibilityRole="header">
          {t('pro.title')}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(80).duration(450)} style={styles.sub}>
          {reason === 'limit' ? t('pro.limit') : reason === 'draft' || reason === 'chat' || reason === 'week' || reason === 'photo' ? t(`pro.reason.${reason}`) : t('pro.subtitle')}
        </Animated.Text>

        <View style={styles.perks}>
          {perks.map((p, i) => (
            <Animated.View key={p.title} entering={FadeInDown.delay(160 + i * 70).duration(420)} style={styles.perk}>
              <View style={styles.perkIcon}>{p.icon}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkBody}>{p.body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {plans ? (
          <Animated.View entering={FadeInUp.delay(450).duration(420)} style={{ gap: 10 }}>
            {plans.map((p) => {
              const on = p.id === pick;
              const off = save(p);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    setPick(p.id);
                  }}
                  style={[styles.plan, on && styles.planOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <CheckIcon color={colors.white} size={12} /> : null}</View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.planName}>{t(p.kind === 'annual' ? 'pro.annual' : 'pro.monthly')}</Text>
                    <Text style={styles.planMeta}>
                      {p.kind === 'annual' && p.perMonth ? t('pro.perMonth', { price: p.perMonth }) : t('pro.cancelAnytime')}
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>{p.price}</Text>
                  {off > 0 ? (
                    <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                      <Text style={styles.badgeText}>{t('pro.save', { n: off })}</Text>
                    </LinearGradient>
                  ) : null}
                </Pressable>
              );
            })}
          </Animated.View>
        ) : (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 24 }} />
        )}
        {!live && __DEV__ ? <Text style={styles.dev}>{t('pro.devNote')}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => void buy()} disabled={!plan || busy} style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.ctaText}>{plan?.trialDays ? t('pro.trial', { n: plan.trialDays }) : t('pro.continue')}</Text>
          )}
        </Pressable>
        <Text style={styles.fine}>
          {plan ? (plan.trialDays ? t('pro.fineTrial', { n: plan.trialDays, price: plan.price }) : t('pro.fine', { price: plan.price })) : ' '}
        </Text>
        {note ? <Text style={styles.fine}>{note}</Text> : null}
        <View style={styles.links}>
          <Pressable onPress={() => void restore()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t('pro.restore')}</Text>
          </Pressable>
          {SITE_URL ? (
            <>
              <Pressable onPress={() => openPage('terminos')} hitSlop={8} accessibilityRole="link">
                <Text style={styles.link}>{t('account.terms')}</Text>
              </Pressable>
              <Pressable onPress={() => openPage('privacidad')} hitSlop={8} accessibilityRole="link">
                <Text style={styles.link}>{t('account.privacy')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 56, marginTop: 4 },
  body: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24, gap: 12 },
  title: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, letterSpacing: -1.3, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.muted },
  perks: { gap: 14, marginVertical: 14 },
  perk: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  perkIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  perkBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line },
  planOn: { borderColor: colors.ink, backgroundColor: colors.card },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  planName: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  planMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  planPrice: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  badge: { position: 'absolute', top: -10, right: 16, paddingHorizontal: 10, height: 22, borderRadius: 11, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white, letterSpacing: 0.3 },
  dev: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, gap: 8 },
  cta: { minHeight: 58, borderRadius: 29, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
  fine: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 20, minHeight: 32, alignItems: 'center' },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },
});
