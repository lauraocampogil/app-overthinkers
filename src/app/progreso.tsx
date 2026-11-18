import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { Barra } from '@/components/Barra';
import { ArrowRightIcon, ClockIcon, MoonIcon, SunIcon, TargetIcon } from '@/components/Iconos';
import { FlameIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { useFoco } from '@/lib/foco';
import { useVoz } from '@/lib/paleta';
import { areaRings, focusScore } from '@/lib/puntuacion';
import { addDays, daysBetween } from '@/lib/planner';
import { goalProgress, todayIso, useDay, weekStart } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Progress: what you did this week, at a glance. Overthinkers like the overview,
 * so everything here is a count or a bar, never a list to read.
 */
export default function Progreso() {
  const tasks = useDay((s) => s.tasks);
  const goals = useDay((s) => s.goals);
  const streak = useDay((s) => s.streak);
  const history = useDay((s) => s.history);
  const focusLog = useDay((s) => s.focusLog ?? {});
  const routineLog = useDay((s) => s.routineLog);
  const voz = useVoz();
  const areas = useDay((s) => s.profile.areas);
  const lives = useFoco((s) => s.lives ?? {});

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
  const live = goals.filter((g) => !g.archived);
  const rings = areaRings(tasks, areas, week);
  const score = focusScore({ tasks, week, today, focusLog, lives });
  const areaName = (a: (typeof areas)[number]) => (a.id === 'otra' ? a.label || t('area.otra') : t(`area.${a.id}`));

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
    <Screen tabs>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('tab.progress')}
        </Text>
        <IconCircle label={t('account.title')} onPress={() => router.push('/cuenta')} size={34}>
          <PersonIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push('/racha')} style={styles.streak} accessibilityRole="button">
          <View style={styles.streakIcon}>
            <FlameIcon />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakNum}>{t('home.streak', { n: streak.current })}</Text>
            <Text style={styles.muted}>{t('progress.best', { n: streak.best })}</Text>
          </View>
          <ArrowRightIcon color={colors.muted} />
        </Pressable>

        <View style={styles.scoreCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.scoreLabel}>{t('score.title')}</Text>
            <Text style={styles.scoreNum} accessibilityLabel={t('score.a11y', { n: score.score })}>
              {score.score}
              <Text style={styles.scoreOf}>/100</Text>
            </Text>
            <Text style={styles.scoreSub}>{t('score.body', { focus: minutesLabel(score.minutes), stay: score.stay, done: score.done })}</Text>
          </View>
          <Anillo progress={score.score / 100} size={74} stroke={7} color={voz.mic[1]} />
        </View>

        {rings.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('rings.title')}</Text>
            <View style={styles.rings}>
              {rings.map((r, i) => (
                <View key={r.area.id + i} style={styles.ringCol}>
                  <Anillo progress={r.pct} size={78} stroke={7} color={voz.mic[i % voz.mic.length]} label={r.total ? `${r.done}/${r.total}` : '–'} />
                  <Text style={styles.ringName} numberOfLines={2}>
                    {areaName(r.area)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
          <View style={styles.tile}>
            <SunIcon size={18} />
            <Text style={styles.tileNum}>{routineDays('manana')}/7</Text>
            <Text style={styles.muted}>{t('routine.manana')}</Text>
          </View>
          <View style={styles.tile}>
            <MoonIcon size={18} />
            <Text style={styles.tileNum}>{routineDays('noche')}/7</Text>
            <Text style={styles.muted}>{t('routine.noche')}</Text>
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

        {live.length ? <Text style={styles.section}>{t('tab.goals')}</Text> : null}
        {live.map((g) => {
          const p = goalProgress(g, tasks);
          const left = g.due ? daysBetween(today, g.due) : null;
          return (
            <Pressable key={g.id} onPress={() => router.push({ pathname: '/meta', params: { id: g.id } })} style={styles.goal} accessibilityRole="button">
              <Anillo progress={p.pct} size={52} stroke={5} color={voz.mic[1]} label={`${Math.round(p.pct * 100)}%`} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.goalTitle} numberOfLines={2}>
                  {g.title}
                </Text>
                <Text style={styles.muted}>
                  {left !== null ? t('goals.daysLeft', { n: Math.max(0, left) }) : t('goals.weekCount', { done: p.done, total: p.total })}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!live.length && !weekDone ? <Text style={type.muted}>{t('progress.empty')}</Text> : null}
      </ScrollView>
      <Barra active="progreso" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52, marginTop: 6 },
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 150, gap: 12 },
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
