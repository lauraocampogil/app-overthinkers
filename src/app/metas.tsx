import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { Barra } from '@/components/Barra';
import { ArrowRightIcon, CalendarIcon } from '@/components/Iconos';
import { CheckIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { addDays, daysBetween } from '@/lib/planner';
import type { Goal } from '@/lib/types';
import { goalProgress, todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Semana: the next 7 days at a glance, each with what Okio put on it. Tap a day to move things around.
 * Goals sit below, small: their steps already live in the days above.
 */
function dueLabel(goal: Goal, done: number, total: number) {
  if (goal.type === 'semanal') return t('goals.weekCount', { done, total });
  if (!goal.due) return '';
  const diff = daysBetween(todayIso(), goal.due);
  if (diff <= 0) return t('due.today');
  return t('goals.daysShort', { n: diff });
}

export default function Semana() {
  const goals = useDay((s) => s.goals);
  const tasks = useDay((s) => s.tasks);
  const archiveGoal = useDay((s) => s.archiveGoal);
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const live = goals.filter((g) => !g.archived).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));

  const confirmArchive = (goal: Goal) =>
    Alert.alert(goal.title, t('goals.archiveBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('goals.archive'), style: 'destructive', onPress: () => archiveGoal(goal.id) },
    ]);

  const dayName = (d: string, i: number) =>
    i === 0 ? t('due.today') : i === 1 ? t('due.tomorrow') : new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric' });

  const empty = days.every((d) => !tasks.some((x) => x.day === d));

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
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push('/semana')} style={({ pressed }) => [styles.plan, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.planTitle}>{t('week.cardTitle')}</Text>
            <Text style={styles.planBody}>{t('week.cardBody')}</Text>
          </View>
          <ArrowRightIcon size={14} color={colors.white} />
        </Pressable>

        {empty ? <Text style={[type.muted, { paddingHorizontal: 6 }]}>{t('week.emptyTab')}</Text> : null}

        {days.map((d, i) => {
          const list = tasks.filter((x) => x.day === d && (x.status === 'pendiente' || x.doneOn === d));
          const open = list.filter((x) => x.status === 'pendiente');
          const shown = [...list].sort((a, b) => Number(Boolean(b.top)) - Number(Boolean(a.top)) || (a.at ?? '99').localeCompare(b.at ?? '99')).slice(0, 4);
          return (
            <Pressable
              key={d}
              onPress={() => router.push({ pathname: '/agenda', params: { d } })}
              style={({ pressed }) => [styles.day, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`${dayName(d, i)}: ${t('week.dayCount', { n: open.length })}`}
            >
              <View style={styles.dayTop}>
                <Text style={[styles.dayName, i === 0 && { color: colors.ink }]}>{dayName(d, i)}</Text>
                <Text style={styles.dayCount}>{list.length ? t('week.dayCount', { n: open.length }) : t('week.free')}</Text>
              </View>
              {shown.map((x) => (
                <View key={x.id} style={styles.row}>
                  <View style={[styles.box, x.status === 'hecha' && styles.boxOn]}>{x.status === 'hecha' ? <CheckIcon color={colors.white} size={9} /> : null}</View>
                  <Text style={[styles.rowText, x.status === 'hecha' && styles.done]} numberOfLines={1}>
                    {x.title}
                  </Text>
                  {x.at ? <Text style={styles.at}>{x.at}</Text> : null}
                </View>
              ))}
              {list.length > shown.length ? <Text style={styles.more}>+{list.length - shown.length}</Text> : null}
            </Pressable>
          );
        })}

        {live.length ? <Text style={styles.section}>{t('tab.goals')}</Text> : null}
        {live.map((goal) => {
          const p = goalProgress(goal, tasks);
          return (
            <Pressable
              key={goal.id}
              onPress={() => router.push({ pathname: '/meta', params: { id: goal.id } })}
              onLongPress={() => confirmArchive(goal)}
              style={styles.goal}
              accessibilityHint={t('goals.longPress')}
            >
              <Anillo progress={p.pct} size={40} stroke={4} label={`${Math.round(p.pct * 100)}`} />
              <Text style={styles.goalTitle} numberOfLines={1}>
                {goal.title}
              </Text>
              <Text style={styles.goalDue}>{dueLabel(goal, p.done, p.total)}</Text>
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
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 140, gap: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 24, backgroundColor: colors.ink },
  planTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
  planBody: { fontFamily: fonts.regular, fontSize: 13, color: '#BDBDBD' },
  day: { backgroundColor: colors.card, borderRadius: 22, padding: 16, gap: 8 },
  dayTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted, textTransform: 'capitalize' },
  dayCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
  box: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  rowText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  at: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  more: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  section: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, paddingHorizontal: 6, marginTop: 14 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14 },
  goalTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  goalDue: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
});
