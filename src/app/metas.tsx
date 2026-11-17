import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { Pestanas } from '@/components/Pestanas';
import { TaskSheet } from '@/components/TaskSheet';
import { CheckIcon, Dock, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { daysBetween } from '@/lib/planner';
import type { Goal, Task } from '@/lib/types';
import { goalProgress, todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Goals: big things broken down into tasks GetGo puts on the calendar.
 * What is due soon stays on top, weekly goals show today's step, long-term goals wait below.
 */
function dueLabel(goal: Goal, done: number, total: number) {
  if (goal.type === 'semanal') return t('goals.weekCount', { done, total });
  if (!goal.due) return '';
  const diff = daysBetween(todayIso(), goal.due);
  if (diff <= 0) return t('due.today');
  if (diff === 1) return t('due.tomorrow');
  if (diff < 7) return new Date(`${goal.due}T12:00:00`).toLocaleDateString(locale, { weekday: 'long' });
  return new Date(`${goal.due}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function Metas() {
  const goals = useDay((s) => s.goals);
  const tasks = useDay((s) => s.tasks);
  const { markDone, undoDone, archiveGoal } = useDay.getState();
  const [sheet, setSheet] = useState<Task | null>(null);

  const live = goals.filter((g) => !g.archived);
  const soon = live
    .filter((g) => g.type === 'pronto' || (g.type === 'largo' && g.due && daysBetween(todayIso(), g.due) <= 21))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const weekly = live.filter((g) => g.type === 'semanal');
  const longTerm = live.filter((g) => !soon.includes(g) && g.type === 'largo');

  const confirmArchive = (goal: Goal) =>
    Alert.alert(goal.title, t('goals.archiveBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('goals.archive'), style: 'destructive', onPress: () => archiveGoal(goal.id) },
    ]);

  const goalCard = (goal: Goal) => {
    const p = goalProgress(goal, tasks);
    const pct = p.total ? p.done / p.total : 0;
    const shown = goal.type === 'semanal' ? p.next.slice(0, 1) : p.next.slice(0, 3);
    return (
      <Pressable key={goal.id} onLongPress={() => confirmArchive(goal)} style={styles.goal} accessibilityHint={t('goals.longPress')}>
        <Anillo progress={pct} size={58} stroke={6} label={`${Math.round(pct * 100)}%`} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={styles.goalTop}>
            <Text style={styles.goalTitle} numberOfLines={2}>
              {goal.title}
            </Text>
            <Text style={styles.goalDue}>{dueLabel(goal, p.done, p.total)}</Text>
          </View>
          {shown.map((task) => (
            <Pressable key={task.id} style={styles.step} onPress={() => setSheet(task)}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: task.status === 'hecha' }}
                accessibilityLabel={task.title}
                onPress={() => (task.status === 'hecha' ? undoDone(task.id) : markDone(task.id))}
                hitSlop={10}
                style={[styles.box, task.status === 'hecha' && styles.boxOn]}
              >
                {task.status === 'hecha' ? <CheckIcon color={colors.white} size={10} /> : null}
              </Pressable>
              <Text style={styles.stepText} numberOfLines={1}>
                {goal.type === 'semanal' && task.day === todayIso() ? t('goals.todayStep', { title: task.title }) : task.title}
              </Text>
            </Pressable>
          ))}
          {!shown.length ? <Text style={styles.stepMuted}>{t(p.total ? 'goals.allDone' : 'goals.noSteps')}</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pestanas active="metas" />
        <IconCircle label={t('account.title')} onPress={() => router.push('/cuenta')} size={34}>
          <PersonIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {!live.length ? (
          <View style={styles.empty}>
            <Text style={type.title} accessibilityRole="header">
              {t('goals.emptyTitle')}
            </Text>
            <Text style={type.muted}>{t('goals.emptyBody')}</Text>
          </View>
        ) : null}
        {soon.length ? <Text style={styles.section}>{t('goals.soon')}</Text> : null}
        {soon.map(goalCard)}
        {weekly.length ? <Text style={styles.section}>{t('goals.weekly')}</Text> : null}
        {weekly.map(goalCard)}
        {longTerm.length ? <Text style={styles.section}>{t('goals.long')}</Text> : null}
        {longTerm.map(goalCard)}
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/escribir', params: { meta: '1' } })} style={styles.add}>
          <Text style={styles.addText}>{t('goals.add')}</Text>
        </Pressable>
      </ScrollView>
      <View style={styles.dock} pointerEvents="box-none">
        <Dock onWrite={() => router.push({ pathname: '/escribir', params: { meta: '1' } })} onSpeak={() => router.push('/escuchando')} />
      </View>
      <TaskSheet task={sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52, marginTop: 6 },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 140, gap: 10 },
  empty: { gap: 10, marginTop: 20, marginBottom: 12 },
  section: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, paddingHorizontal: 6, marginTop: 8 },
  goal: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 24, padding: 16 },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  goalTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: colors.ink },
  goalDue: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentDark, textTransform: 'capitalize' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  box: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#D9CCF5', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  stepMuted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  add: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.white, marginTop: 10 },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accentDark },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 28 },
});
