import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { CloseIcon, IconCircle, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { daysBetween } from '@/lib/planner';
import type { Goal } from '@/lib/types';
import { goalProgress, todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Your goals, opened from the pill at the top of Hoy. Goals are not created here: you say them when you
 * empty your head ("quiero aprobar Historia en enero") and Okio puts their steps in your days.
 */
function dueLabel(goal: Goal, done: number, total: number) {
  if (goal.type === 'semanal') return t('goals.weekCount', { done, total });
  if (!goal.due) return '';
  const diff = daysBetween(todayIso(), goal.due);
  if (diff <= 0) return t('due.today');
  return t('goals.daysShort', { n: diff });
}

export default function Objetivos() {
  const goals = useDay((s) => s.goals);
  const tasks = useDay((s) => s.tasks);
  const archiveGoal = useDay((s) => s.archiveGoal);
  const live = goals.filter((g) => !g.archived).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));

  const confirmArchive = (goal: Goal) =>
    Alert.alert(goal.title, t('goals.archiveBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      { text: t('goals.archive'), style: 'destructive', onPress: () => archiveGoal(goal.id) },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()} size={34}>
          <CloseIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={type.title} accessibilityRole="header">
          {t('goals.yours')}
        </Text>
        <Text style={type.muted}>{t('goals.howTo')}</Text>
        {live.map((goal) => {
          const pr = goalProgress(goal, tasks);
          const next = tasks
            .filter((x) => x.goalId === goal.id && x.status === 'pendiente')
            .sort((a, b) => a.day.localeCompare(b.day))[0];
          return (
            <Pressable
              key={goal.id}
              onPress={() => router.push({ pathname: '/meta', params: { id: goal.id } })}
              onLongPress={() => confirmArchive(goal)}
              style={({ pressed }) => [styles.goal, pressed && { opacity: 0.85 }]}
              accessibilityHint={t('goals.longPress')}
            >
              <Anillo progress={pr.pct} size={56} stroke={5} label={`${Math.round(pr.pct * 100)}`} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.goalTitle} numberOfLines={2}>
                  {goal.title}
                </Text>
                <Text style={styles.goalDue}>{[dueLabel(goal, pr.done, pr.total), t('goals.steps', { done: pr.done, total: pr.total })].filter(Boolean).join(' · ')}</Text>
                {next ? (
                  <Text style={styles.next} numberOfLines={1}>
                    {t('goals.nextStep', { step: next.title })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {!live.length ? <Text style={[type.muted, { marginTop: 20 }]}>{t('goals.none')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, minHeight: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 12 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 24, padding: 16 },
  goalTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  goalDue: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  next: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.ink },
});
