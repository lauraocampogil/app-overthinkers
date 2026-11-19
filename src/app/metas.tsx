import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { Barra } from '@/components/Barra';
import { ArrowRightIcon, CalendarIcon } from '@/components/Iconos';
import { CheckIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { dayTimeline, useAgenda } from '@/lib/calendario';
import { estimate } from '@/lib/duraciones';
import { useVoz } from '@/lib/paleta';
import { addDays, daysBetween } from '@/lib/planner';
import type { Goal, Task } from '@/lib/types';
import { goalProgress, todayIso, useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Semana: what there is to do this week, at a glance.
 * On top, the 7 days as columns whose bar shows how full each day is (tap one to jump to it);
 * below, each day with its things in order and their hours. Goals sit at the end, small:
 * they are born from what you tell Okio and their steps already live in the days.
 */
const FULL_DAY = 6 * 60; // a bar is full at 6 hours of tasks

const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function dueLabel(goal: Goal, done: number, total: number) {
  if (goal.type === 'semanal') return t('goals.weekCount', { done, total });
  if (!goal.due) return '';
  const diff = daysBetween(todayIso(), goal.due);
  if (diff <= 0) return t('due.today');
  return t('goals.daysShort', { n: diff });
}

export default function Semana() {
  const voz = useVoz();
  const goals = useDay((s) => s.goals);
  const tasks = useDay((s) => s.tasks);
  const learned = useDay((s) => s.learned);
  const settings = withDefaults(useDay((s) => s.settings));
  const agendaOn = useAgenda((s) => s.status) === 'on';
  const archiveGoal = useDay((s) => s.archiveGoal);
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const live = goals.filter((g) => !g.archived).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const scroll = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<string, number>>({});
  const [sel, setSel] = useState(today);
  const minutesOf = (x: Task) => estimate(x, learned).minutes;

  const confirmArchive = (goal: Goal) =>
    Alert.alert(goal.title, t('goals.archiveBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('goals.archive'), style: 'destructive', onPress: () => archiveGoal(goal.id) },
    ]);

  const weekday = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, opts);
  const dayTitle = (d: string, i: number) => (i === 0 ? t('due.today') : i === 1 ? t('due.tomorrow') : weekday(d, { weekday: 'long' }));

  // Each day: its tasks in order, with the hour they have (fixed, or the slot Okio found).
  const plan = days.map((d) => {
    const list = tasks.filter((x) => x.day === d && (x.status === 'pendiente' || x.doneOn === d));
    const open = list.filter((x) => x.status === 'pendiente');
    const timeline = agendaOn ? dayTimeline(d, open, minutesOf, settings) : null;
    const hour = (x: Task) => {
      if (x.at) return x.at;
      const b = timeline?.blocks.find((y) => y.type === 'task' && y.task.id === x.id);
      return b ? clock(b.start) : '';
    };
    const rows = list
      .map((x) => ({ task: x, at: hour(x), fixed: !!x.at }))
      .sort((a, b) => Number(a.task.status === 'hecha') - Number(b.task.status === 'hecha') || (a.at || '99').localeCompare(b.at || '99'));
    const minutes = open.reduce((n, x) => n + minutesOf(x), 0);
    return { d, rows, open: open.length, minutes };
  });
  const empty = plan.every((p) => !p.rows.length);

  const jump = (d: string) => {
    setSel(d);
    const y = offsets.current[d];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  return (
    <Screen tabs>
      <View style={styles.header}>
        <Text style={styles.screenTitle} accessibilityRole="header">
          {t('tab.week')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconCircle label={t('month.title')} onPress={() => router.push('/mes')} size={34}>
            <CalendarIcon size={17} />
          </IconCircle>
          <IconCircle label={t('account.title')} onPress={() => router.push('/cuenta')} size={34}>
            <PersonIcon />
          </IconCircle>
        </View>
      </View>

      {/* The week as 7 columns: how full each day is. */}
      <View style={styles.strip} accessibilityRole="tablist">
        {plan.map((p, i) => {
          const on = sel === p.d;
          const fill = Math.min(1, p.minutes / FULL_DAY);
          return (
            <Pressable
              key={p.d}
              onPress={() => jump(p.d)}
              style={[styles.col, on && styles.colOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${dayTitle(p.d, i)}: ${t('week.dayCount', { n: p.open })}${p.minutes ? `, ${minutesLabel(p.minutes)}` : ''}`}
            >
              <Text style={[styles.colDay, on && { color: colors.white }]}>{weekday(p.d, { weekday: 'narrow' })}</Text>
              <Text style={[styles.colNum, on && { color: colors.white }]}>{Number(p.d.slice(8))}</Text>
              <View style={[styles.bar, on && { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                {fill > 0 ? (
                  <LinearGradient colors={voz.mic} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.barFill, { height: `${Math.max(12, fill * 100)}%` }]} />
                ) : null}
              </View>
              <Text style={[styles.colCount, on && { color: 'rgba(255,255,255,0.75)' }]}>{p.open || '·'}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push('/semana')} style={({ pressed }) => [styles.plan, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.planTitle}>{t('week.cardTitle')}</Text>
            <Text style={styles.planBody}>{t('week.cardBody')}</Text>
          </View>
          <ArrowRightIcon size={14} color={colors.white} />
        </Pressable>

        {empty ? <Text style={[type.muted, { paddingHorizontal: 4 }]}>{t('week.emptyTab')}</Text> : null}

        {plan.map((p, i) => (
          <View key={p.d} onLayout={(e) => (offsets.current[p.d] = e.nativeEvent.layout.y)} style={styles.day}>
            <Pressable onPress={() => router.push({ pathname: '/agenda', params: { d: p.d } })} style={styles.dayHead} accessibilityRole="button" accessibilityHint={t('week.openDay')}>
              <Text style={styles.dayName}>
                {dayTitle(p.d, i)}
                <Text style={styles.dayDate}>  {weekday(p.d, i < 2 ? { weekday: 'long', day: 'numeric' } : { day: 'numeric', month: 'short' })}</Text>
              </Text>
              <Text style={styles.dayMeta}>{p.rows.length ? `${t('week.dayCount', { n: p.open })}${p.minutes ? ` · ${minutesLabel(p.minutes)}` : ''}` : t('week.free')}</Text>
            </Pressable>
            {p.rows.map(({ task, at, fixed }) => (
              <Pressable key={task.id} onPress={() => router.push({ pathname: '/agenda', params: { d: p.d } })} style={styles.row}>
                <Text style={[styles.at, !fixed && at ? styles.atSoft : null]}>{at || '—'}</Text>
                {task.top || task.importance === 3 ? <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.mark} /> : <View style={styles.markQuiet} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, task.status === 'hecha' && styles.done]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.where ? (
                    <Text style={styles.where} numberOfLines={1}>
                      {task.where}
                    </Text>
                  ) : null}
                </View>
                {task.status === 'hecha' ? (
                  <View style={styles.doneDot}>
                    <CheckIcon color={colors.white} size={9} />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}

        <Text style={styles.section}>{t('goals.yours')}</Text>
        <Text style={[type.muted, { paddingHorizontal: 4, marginTop: -4 }]}>{t('goals.howTo')}</Text>
        {live.map((goal) => {
          const pr = goalProgress(goal, tasks);
          return (
            <Pressable
              key={goal.id}
              onPress={() => router.push({ pathname: '/meta', params: { id: goal.id } })}
              onLongPress={() => confirmArchive(goal)}
              style={styles.goal}
              accessibilityHint={t('goals.longPress')}
            >
              <Anillo progress={pr.pct} size={40} stroke={4} label={`${Math.round(pr.pct * 100)}`} />
              <Text style={styles.goalTitle} numberOfLines={1}>
                {goal.title}
              </Text>
              <Text style={styles.goalDue}>{dueLabel(goal, pr.done, pr.total)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Barra active="metas" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52, marginTop: 6 },
  strip: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  col: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.card },
  colOn: { backgroundColor: colors.ink },
  colDay: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase' },
  colNum: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  bar: { width: 8, height: 44, borderRadius: 4, backgroundColor: colors.line, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: 8, borderRadius: 4 },
  colCount: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  body: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 140, gap: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.ink },
  planTitle: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.white },
  planBody: { fontFamily: fonts.regular, fontSize: 13, color: '#BDBDBD' },
  day: { gap: 2, paddingTop: 6 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  dayName: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.ink, textTransform: 'capitalize', flexShrink: 1 },
  dayDate: { fontFamily: fonts.medium, fontSize: 13.5, letterSpacing: 0, color: colors.muted, textTransform: 'none' },
  dayMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 4 },
  at: { width: 48, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  atSoft: { color: colors.muted, fontFamily: fonts.medium },
  mark: { width: 4, alignSelf: 'stretch', marginVertical: 8, borderRadius: 2 },
  markQuiet: { width: 4, alignSelf: 'stretch', marginVertical: 8, borderRadius: 2, backgroundColor: colors.line },
  rowText: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.ink },
  where: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  doneDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  section: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.ink, paddingHorizontal: 4, marginTop: 18 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 },
  goalTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  goalDue: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
});
