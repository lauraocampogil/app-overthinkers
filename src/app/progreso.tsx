import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ClockIcon, TargetIcon } from '@/components/Iconos';
import { CloseIcon, IconCircle, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { useDiario } from '@/lib/diario';
import { bondLevel, bondStage, useVinculo } from '@/lib/vinculo';
import { Mascota } from '@/components/Mascota';
import { useVoz } from '@/lib/paleta';
import { addDays } from '@/lib/planner';
import { todayIso, useDay, weekStart } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Okio: your own mascot and how the bond grows, then what you did this week and the month's photos.
 * Counts and bars, never a list to read. Goals live in Semana.
 */
export default function Progreso() {
  const tasks = useDay((s) => s.tasks);
  const goals = useDay((s) => s.goals);
  const streak = useDay((s) => s.streak);
  const history = useDay((s) => s.history);
  const focusLog = useDay((s) => s.focusLog ?? {});
  const routineLog = useDay((s) => s.routineLog);
  const voz = useVoz();
  const mascot = useMascot();
  const entries = useDiario((x) => x.entries);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const bondPoints = useVinculo((s) => s.points);

  const today = todayIso();
  const start = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const doneOn = (d: string) => tasks.filter((x) => x.status === 'hecha' && x.doneOn === d).length;
  const counts = week.map(doneOn);
  const max = Math.max(3, ...counts);
  const weekDone = counts.reduce((a, b) => a + b, 0);
  const focusWeek = week.reduce((a, d) => a + (focusLog[d] ?? 0), 0);
  const fullDays = week.filter((d) => history[d] === 'done').length;
  const routineDays = (kind: 'manana' | 'noche') => week.filter((d) => (routineLog[d]?.[kind] ?? []).length > 0).length;

  // Memories: a month calendar with the photo of each day (task proofs and progress photos).
  const [month, setMonth] = useState(0);
  const now = new Date(`${today}T12:00:00`);
  const monthDate = new Date(now.getFullYear(), now.getMonth() + month, 1, 12);
  const first = (monthDate.getDay() + 6) % 7;
  const inMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const iso = (n: number) => `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const cells: (string | null)[] = [...Array.from({ length: first }, () => null), ...Array.from({ length: inMonth }, (_, i) => iso(i + 1))];
  const photoOf = (d: string) =>
    tasks.find((x) => x.status === 'hecha' && x.doneOn === d && x.proofPhoto)?.proofPhoto ??
    goals.flatMap((g) => g.checkins ?? []).find((c) => c.date === d && c.photo)?.photo ??
    null;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={34}>
          <CloseIcon />
        </IconCircle>
        <Text style={styles.title} accessibilityRole="header">
          {t('tab.okio')}
        </Text>
        <View style={{ width: 34 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Mascota seed={mascot.seed} size={170} />
          <Text style={styles.heroTitle}>{t(`bond.stage${bondStage(bondPoints)}`)}</Text>
          {/* The streak lives here, as the bond: one number, no separate streak screen. */}
          <Text style={styles.together}>{t('bond.days', { n: streak.current })}</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>{t('bond.body')}</Text>
          <View style={styles.bondBar} accessibilityLabel={t('bond.pct', { n: Math.round(bondLevel(bondPoints) * 100) })}>
            <View style={[styles.bondFill, { width: `${Math.round(bondLevel(bondPoints) * 100)}%`, backgroundColor: voz.mic[1] }]} />
          </View>
          <Pressable onPress={() => router.push('/mentor')} style={({ pressed }) => [styles.talk, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Text style={styles.talkText}>{t('read.talk')}</Text>
          </Pressable>
        </View>


        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('progress.thisWeek')}</Text>
            <Text style={styles.big}>{weekDone}</Text>
          </View>
          <Text style={styles.muted}>{t('progress.tasksDone')}</Text>
          <View style={styles.chart} accessibilityLabel={t('progress.chartLabel', { n: weekDone })}>
            {week.map((d, i) => {
              const h = (counts[i] / max) * 100;
              const isToday = d === today;
              return (
                <View key={d} style={styles.barCol}>
                  <Text style={styles.barNum}>{counts[i] || ''}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: `${Math.max(counts[i] ? 8 : 0, h)}%`, backgroundColor: isToday ? voz.mic[1] : colors.ink }]} />
                  </View>
                  <Text style={[styles.barDay, isToday && { color: colors.ink, fontFamily: fonts.semibold }]}>
                    {new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'narrow' })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <ClockIcon size={18} />
            <Text style={styles.tileNum}>{minutesLabel(focusWeek)}</Text>
            <Text style={styles.muted}>{t('progress.focus')}</Text>
          </View>
          <View style={styles.tile}>
            <TargetIcon size={18} />
            <Text style={styles.tileNum}>{fullDays}/7</Text>
            <Text style={styles.muted}>{t('progress.fullDays')}</Text>
          </View>
        </View>

        <Text style={styles.section}>{t('memories.title')}</Text>
        <View style={styles.card}>
          <View style={styles.monthHead}>
            <Pressable onPress={() => setMonth((m) => m - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('memories.prev')}>
              <Text style={styles.monthArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthName}>{monthDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</Text>
            <Pressable onPress={() => setMonth((m) => Math.min(0, m + 1))} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('memories.next')}>
              <Text style={[styles.monthArrow, month === 0 && { color: colors.line }]}>›</Text>
            </Pressable>
          </View>
          <View style={styles.cal}>
            {cells.map((d, k) =>
              d ? (
                <Pressable key={d} onPress={() => router.push({ pathname: '/dia', params: { d } })} style={styles.cell} accessibilityRole="button" accessibilityLabel={d}>
                  {photoOf(d) ? (
                    <Image source={{ uri: photoOf(d)! }} style={styles.cellPhoto} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.cellPhoto, { backgroundColor: doneOn(d) ? colors.line : colors.white }]} />
                  )}
                  <Text style={[styles.cellNum, photoOf(d) && styles.cellNumOn, d === today && styles.cellToday]}>{Number(d.slice(8))}</Text>
                </Pressable>
              ) : (
                <View key={`e${k}`} style={styles.cell} />
              ),
            )}
          </View>
        </View>

        {!weekDone ? <Text style={type.muted}>{t('progress.empty')}</Text> : null}
        {/* Okio as a journal: what you told it when closing the day, newest first. */}
        {entries.length ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={styles.journalTitle}>{t('journal.title')}</Text>
            {entries
              .slice(-7)
              .reverse()
              .map((e) => (
                <Pressable key={e.day} onPress={() => setOpenEntry(openEntry === e.day ? null : e.day)} style={styles.entry} accessibilityRole="button">
                  <Text style={styles.entryDay}>{new Date(`${e.day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
                  <Text style={styles.entryText} numberOfLines={openEntry === e.day ? undefined : 3}>
                    {e.text}
                  </Text>
                </Pressable>
              ))}
          </View>
        ) : (
          <Text style={[type.muted, { marginTop: 8 }]}>{t('journal.empty')}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52, marginTop: 6 },
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 48, gap: 12 },
  journalTitle: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.ink },
  entry: { backgroundColor: colors.card, borderRadius: 20, padding: 16, gap: 6 },
  entryDay: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textTransform: 'capitalize' },
  entryText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  hero: { alignItems: 'center', gap: 8, paddingBottom: 6 },
  together: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  heroTitle: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.6, color: colors.ink, textAlign: 'center' },
  bondBar: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden', marginTop: 4, marginHorizontal: 30 },
  bondFill: { height: 6, borderRadius: 3 },
  talk: { marginTop: 6, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.card, justifyContent: 'center' },
  talkText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, backgroundColor: colors.card },
  streakIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  streakNum: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  card: { padding: 18, borderRadius: 24, backgroundColor: colors.card, gap: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  big: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1, color: colors.ink },
  chart: { flexDirection: 'row', gap: 8, height: 150, marginTop: 14 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barNum: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, height: 14 },
  barTrack: { flex: 1, width: '100%', borderRadius: 8, backgroundColor: colors.white, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  barDay: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.4%', padding: 16, borderRadius: 22, backgroundColor: colors.card, gap: 6 },
  tileNum: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.8, color: colors.ink, marginTop: 4 },
  section: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.5, color: colors.ink, marginTop: 10 },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthArrow: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink, paddingHorizontal: 8 },
  monthName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, textTransform: 'capitalize' },
  cal: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.8, padding: 2 },
  cellPhoto: { flex: 1, borderRadius: 10 },
  cellNum: { position: 'absolute', top: 5, left: 7, fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  cellNumOn: { color: colors.white, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  cellToday: { color: colors.ink, textDecorationLine: 'underline' },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderRadius: 24, backgroundColor: colors.ink },
  scoreLabel: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4, color: '#9A9A9A', textTransform: 'uppercase' },
  scoreNum: { fontFamily: fonts.bold, fontSize: 44, letterSpacing: -1.6, color: colors.white },
  scoreOf: { fontFamily: fonts.medium, fontSize: 18, color: '#7A7A7A', letterSpacing: 0 },
  scoreSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#BDBDBD' },
  rings: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  ringCol: { alignItems: 'center', gap: 8, width: '31%' },
  ringName: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, textAlign: 'center' },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: colors.card },
  goalTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
