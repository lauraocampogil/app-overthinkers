import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackIcon, CheckIcon, IconCircle, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { Mascota } from '@/components/Mascota';
import { deleteAccount, signOut, useAuth, useMascot } from '@/lib/auth';
import { openPage, SITE_URL } from '@/lib/legal';
import { connectCalendar, defaultCalendarId, readableCalendars, refreshAgenda, writableCalendars, type ReadableCalendar, type WritableCalendar } from '@/lib/calendario';
import { connectHealth, disconnectHealth, healthAvailable, useSalud } from '@/lib/salud';
import { connectStrava, disconnectStrava, stravaAvailable, useStrava } from '@/lib/strava';
import { useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

export default function Cuenta() {
  const user = useAuth((s) => s.session?.user);
  const reset = useDay((s) => s.reset);
  const [deleting, setDeleting] = useState(false);
  const mascot = useMascot();
  const settings = withDefaults(useDay((s) => s.settings));
  const setSettings = useDay((s) => s.setSettings);
  const setCalendar = async (mode: 'off' | 'read' | 'write') => {
    if (mode !== 'off' && !(await connectCalendar())) {
      Alert.alert(t('cal.deniedTitle'), t('cal.deniedBody'));
      return;
    }
    const target = mode === 'write' ? settings.calendarTarget ?? (await defaultCalendarId()) : settings.calendarTarget;
    setSettings({ calendar: mode, calendarTarget: target });
    await refreshAgenda({ ...settings, calendar: mode });
    useDay.getState().replan();
    if (mode === 'write') setCals(await writableCalendars());
  };
  const [cals, setCals] = useState<WritableCalendar[]>([]);
  const [readable, setReadable] = useState<ReadableCalendar[]>([]);
  useEffect(() => {
    if (settings.calendar !== 'off') void readableCalendars().then(setReadable);
    else setReadable([]);
  }, [settings.calendar]);
  const toggleRead = (id: string) => {
    const off = settings.calendarsOff ?? [];
    const next = off.includes(id) ? off.filter((x) => x !== id) : [...off, id];
    setSettings({ calendarsOff: next });
    void refreshAgenda({ ...settings, calendarsOff: next });
  };
  useEffect(() => {
    if (settings.calendar === 'write') void writableCalendars().then(setCals);
  }, [settings.calendar]);
  const pickTarget = (id: string) => {
    setSettings({ calendarTarget: id });
    useDay.getState().replan();
  };
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    await Clipboard.setStringAsync('okio://hablar');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const name = (user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined);
  const email = user?.email ?? '';
  const provider = user?.app_metadata?.provider === 'apple' ? 'Apple' : 'Google';

  const confirmDelete = () =>
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const ok = await deleteAccount();
          setDeleting(false);
          if (ok) reset();
          else Alert.alert(t('account.deleteFailed'));
        },
      },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.back')} onPress={() => router.back()}>
          <BackIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={type.title} accessibilityRole="header">{t('account.title')}</Text>

        <View style={styles.card}>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          {email ? <Text style={styles.email}>{email}</Text> : null}
          <Text style={styles.provider}>{t('account.via', { provider })}</Text>
        </View>

        <View style={[styles.card, { alignItems: 'center' }]}>
          {mascot.unlocked ? (
            <>
              <Mascota seed={mascot.seed} size={140} />
              <Text style={[type.muted, { textAlign: 'center' }]}>{t('mascot.yours')}</Text>
            </>
          ) : (
            <Text style={type.muted}>{t('mascot.soon', { n: mascot.daysLeft })}</Text>
          )}
        </View>

        <View style={[styles.card, { gap: 10 }]}>
          <Text style={styles.name}>{t('cal.title')}</Text>
          <Text style={type.muted}>{t('cal.body')}</Text>
          <View style={styles.chips}>
            {(['off', 'read', 'write'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.calendar === m }}
                onPress={() => void setCalendar(m)}
                style={[styles.chip, settings.calendar === m && styles.chipOn]}
              >
                <Text style={[styles.chipText, settings.calendar === m && { color: colors.white }]}>{t(`cal.mode.${m}`)}</Text>
              </Pressable>
            ))}
          </View>
          {readable.length ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={type.muted}>{t('cal.reading')}</Text>
              {Array.from(new Set(readable.map((c) => c.account))).map((acc) => (
                <View key={acc} style={{ gap: 4 }}>
                  <Text style={styles.account}>{acc || t('cal.thisPhone')}</Text>
                  {readable
                    .filter((c) => c.account === acc)
                    .map((c) => {
                      const on = !(settings.calendarsOff ?? []).includes(c.id);
                      return (
                        <Pressable key={c.id} onPress={() => toggleRead(c.id)} style={styles.calRow} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                          <View style={[styles.calDot, { backgroundColor: on ? c.color : colors.line }]} />
                          <Text style={[styles.calRowText, !on && { color: colors.faint }]} numberOfLines={1}>
                            {c.title}
                          </Text>
                          <View style={[styles.calBox, on && styles.calBoxOn]}>{on ? <CheckIcon color={colors.white} size={11} /> : null}</View>
                        </Pressable>
                      );
                    })}
                </View>
              ))}
              <Text style={styles.calHelp}>{t('cal.addGoogle')}</Text>
            </View>
          ) : null}
          {settings.calendar === 'write' && cals.length ? (
            <>
              <Text style={[type.muted, { marginTop: 4 }]}>{t('cal.target')}</Text>
              <View style={styles.chips}>
                {cals.map((c) => {
                  const on = settings.calendarTarget === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => pickTarget(c.id)}
                      style={[styles.chip, styles.calChip, on && styles.chipOn]}
                    >
                      <View style={[styles.calDot, { backgroundColor: c.color || colors.accent }]} />
                      <Text style={[styles.chipText, on && { color: colors.white }]} numberOfLines={1}>
                        {c.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={[type.muted, { marginTop: 4 }]}>{t('cal.hours')}</Text>
          <View style={styles.chips}>
            {['06:00', '07:00', '08:00', '09:00', '10:00'].map((h) => (
              <Pressable key={h} onPress={() => setSettings({ dayStart: h })} style={[styles.chip, settings.dayStart === h && styles.chipOn]}>
                <Text style={[styles.chipText, settings.dayStart === h && { color: colors.white }]}>{h}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chips}>
            {['20:00', '21:00', '22:00', '23:00', '24:00'].map((h) => (
              <Pressable key={h} onPress={() => setSettings({ dayEnd: h })} style={[styles.chip, settings.dayEnd === h && styles.chipOn]}>
                <Text style={[styles.chipText, settings.dayEnd === h && { color: colors.white }]}>{h}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.name}>{t('atajo.title')}</Text>
          <Text style={type.muted}>{t('atajo.body')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void copyLink()} style={styles.copy} hitSlop={6}>
            <Text style={styles.copyText}>{copied ? t('atajo.copied') : t('atajo.copy')}</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/bienvenida', params: { edit: '1' } })} style={styles.row}>
          <Text style={styles.rowText}>{t('ob.editProfile')}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/bienvenida', params: { preview: '1' } })} style={styles.row}>
          <Text style={styles.rowText}>{t('account.replayOnboarding')}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/pro')} style={styles.row}>
          <Text style={styles.rowText}>{t('pro.account')}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/mentor')} style={styles.row}>
          <Text style={styles.rowText}>{t('read.talk')}</Text>
        </Pressable>

        <Conexiones />

        <Pressable accessibilityRole="button" onPress={() => router.push('/bloqueo')} style={styles.row}>
          <Text style={styles.rowText}>{t('block.title')}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/semana')} style={styles.row}>
          <Text style={styles.rowText}>{t('week.title')}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/rutinas')} style={styles.row}>
          <Text style={styles.rowText}>{t('routine.title')}</Text>
        </Pressable>

        {SITE_URL ? (
          <View style={styles.legalRow}>
            <Pressable accessibilityRole="link" onPress={() => openPage('privacidad')} hitSlop={8}>
              <Text style={styles.legalText}>{t('account.privacy')}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => openPage('terminos')} hitSlop={8}>
              <Text style={styles.legalText}>{t('account.terms')}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => openPage('soporte')} hitSlop={8}>
              <Text style={styles.legalText}>{t('account.support')}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.row}>
          <Text style={styles.rowText}>{t('account.signOut')}</Text>
        </Pressable>

        <View style={styles.spacer} />

        <Pressable accessibilityRole="button" onPress={confirmDelete} disabled={deleting} style={styles.danger} hitSlop={8}>
          {deleting ? <ActivityIndicator color="#C2364B" /> : <Text style={styles.dangerText}>{t('account.delete')}</Text>}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

/** Apple Health and Strava: connect once, sport tasks tick themselves afterwards. */
function Conexiones() {
  const health = useSalud();
  const strava = useStrava();
  const [busy, setBusy] = useState<'h' | 's' | null>(null);
  const canHealth = healthAvailable();
  const canStrava = stravaAvailable();

  const toggleHealth = async () => {
    if (health.on) return disconnectHealth();
    setBusy('h');
    const ok = await connectHealth();
    setBusy(null);
    if (!ok) Alert.alert(t('conn.failTitle'), t('conn.healthFail'));
  };
  const toggleStrava = async () => {
    if (strava.on) return void disconnectStrava();
    setBusy('s');
    const ok = await connectStrava();
    setBusy(null);
    if (!ok) Alert.alert(t('conn.failTitle'), t('conn.stravaFail'));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{t('conn.title')}</Text>
      <Text style={styles.calHelp}>{t('conn.body')}</Text>
      <Pressable onPress={canHealth ? () => void toggleHealth() : undefined} style={styles.calRow} accessibilityRole="switch" accessibilityState={{ checked: health.on, disabled: !canHealth }}>
        <Text style={styles.calRowText}>Apple Health</Text>
        {busy === 'h' ? <ActivityIndicator /> : canHealth ? <Text style={styles.connState}>{health.on ? t('conn.on') : t('conn.connect')}</Text> : <Text style={styles.connSoon}>{t('conn.healthLater')}</Text>}
      </Pressable>
      {health.on ? <Text style={styles.calHelp}>{t('conn.steps', { n: health.steps.toLocaleString() })}</Text> : null}
      <Pressable onPress={canStrava ? () => void toggleStrava() : undefined} style={styles.calRow} accessibilityRole="switch" accessibilityState={{ checked: strava.on, disabled: !canStrava }}>
        <Text style={styles.calRowText}>Strava</Text>
        {busy === 's' ? <ActivityIndicator /> : canStrava ? <Text style={styles.connState}>{strava.on ? t('conn.on') : t('conn.connect')}</Text> : <Text style={styles.connSoon}>{t('conn.soon')}</Text>}
      </Pressable>
      {strava.on && strava.last ? <Text style={styles.calHelp}>{t('conn.lastRun', { name: strava.last })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  connState: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  connSoon: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  account: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5, color: colors.muted, textTransform: 'uppercase', marginTop: 6 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  calRowText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  calBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  calBoxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  calHelp: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 6 },
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 16 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 4, marginTop: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  email: { ...type.body, color: colors.ink },
  provider: { ...type.muted, fontSize: 13, marginTop: 4 },
  row: { backgroundColor: colors.card, borderRadius: 20, minHeight: 56, justifyContent: 'center', paddingHorizontal: 20 },
  rowText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  spacer: { flex: 1 },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, paddingHorizontal: 4 },
  legalText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.accentDark },
  calChip: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  calDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentDark },
  copy: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.white },
  copyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentDark },
  danger: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 12 },
  dangerText: { fontFamily: fonts.medium, fontSize: 15, color: colors.danger },
});
