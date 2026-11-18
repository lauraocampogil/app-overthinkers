import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoonIcon, SunIcon } from '@/components/Iconos';
import { BackIcon, CheckIcon, IconCircle, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { routineOf } from '@/lib/rutinas';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** One day, as a memory: what got done, with the photos that proved it. */
export default function Dia() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const day = d ?? '';
  const tasks = useDay((s) => s.tasks);
  const goals = useDay((s) => s.goals);
  const routines = useDay((s) => s.routines);
  const log = useDay((s) => s.routineLog[day]);

  const done = tasks.filter((x) => x.status === 'hecha' && x.doneOn === day);
  const progress = goals.flatMap((g) => (g.checkins ?? []).filter((c) => c.date === day).map((c) => ({ ...c, goal: g.title })));

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.back')} onPress={() => router.back()}>
          <BackIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[type.title, { textTransform: 'capitalize' }]} accessibilityRole="header">
          {day ? new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
        </Text>
        <Text style={type.muted}>{t('memories.dayCount', { n: done.length })}</Text>

        {(['manana', 'noche'] as const).map((k) => {
          const r = routineOf(routines, k);
          const n = (log?.[k] ?? []).length;
          if (!n) return null;
          return (
            <View key={k} style={styles.routine}>
              {k === 'manana' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
              <Text style={styles.routineText}>{t(`routine.${k}`)}</Text>
              <Text style={styles.muted}>
                {n}/{r.steps.length}
              </Text>
            </View>
          );
        })}

        {progress.map((c) =>
          c.photo || c.value ? (
            <View key={`${c.goal}${c.date}`} style={styles.card}>
              {c.photo ? <Image source={{ uri: c.photo }} style={styles.photo} accessibilityIgnoresInvertColors /> : null}
              <View style={styles.cardText}>
                <Text style={styles.title}>{c.goal}</Text>
                {c.value ? <Text style={styles.muted}>{c.value.toLocaleString(locale)} kg</Text> : null}
              </View>
            </View>
          ) : null,
        )}

        {done.map((task) => (
          <View key={task.id} style={styles.card}>
            {task.proofPhoto ? <Image source={{ uri: task.proofPhoto }} style={styles.photo} accessibilityIgnoresInvertColors /> : null}
            <View style={styles.cardText}>
              <View style={styles.check}>
                <CheckIcon color={colors.white} size={12} />
              </View>
              <Text style={[styles.title, { flex: 1 }]}>{task.title}</Text>
              {task.where ? <Text style={styles.muted}>{task.where}</Text> : null}
            </View>
          </View>
        ))}
        {!done.length && !progress.length ? <Text style={type.muted}>{t('memories.empty')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 12 },
  routine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.card },
  routineText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  card: { borderRadius: 24, backgroundColor: colors.card, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 5 },
  cardText: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
