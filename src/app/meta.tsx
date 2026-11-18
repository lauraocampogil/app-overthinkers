import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { CalendarIcon, TargetIcon } from '@/components/Iconos';
import { BackIcon, IconCircle, PrimaryButton, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useVoz } from '@/lib/paleta';
import { addDays, daysBetween } from '@/lib/planner';
import type { Goal } from '@/lib/types';
import { goalProgress, todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const IN_DAYS = [7, 14, 30, 60, 90, 180];

/** One goal: how far it is, how many days are left, its vision, and everything that can be changed. */
export default function Meta() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goal = useDay((s) => s.goals.find((g) => g.id === id));
  const tasks = useDay((s) => s.tasks);
  const { updateGoal, archiveGoal } = useDay.getState();
  const voz = useVoz();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [vision, setVision] = useState(goal?.vision ?? '');

  if (!goal) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconCircle label={t('common.back')} onPress={() => router.back()}>
            <BackIcon />
          </IconCircle>
        </View>
      </Screen>
    );
  }

  const today = todayIso();
  const p = goalProgress(goal, tasks);
  const left = goal.due ? daysBetween(today, goal.due) : null;
  const total = goal.due ? Math.max(1, daysBetween(goal.createdOn, goal.due)) : null;
  const timePct = total && left !== null ? 1 - Math.max(0, left) / total : 0;
  const set = (patch: Partial<Goal>) => updateGoal(goal.id, patch);
  const save = () => {
    set({ title: title.trim() || goal.title, vision: vision.trim() || undefined });
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <IconCircle label={t('common.back')} onPress={() => router.back()}>
            <BackIcon />
          </IconCircle>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Anillo progress={p.total ? p.done / p.total : 0} size={96} stroke={7} color={voz.mic[1]} label={`${p.total ? Math.round((p.done / p.total) * 100) : 0}%`} />
            <View style={{ flex: 1, gap: 6 }}>
              {left !== null ? (
                <>
                  <Text style={styles.big}>{left > 0 ? t('goals.daysLeft', { n: left }) : t('goals.dueToday')}</Text>
                  <View style={styles.timeBar}>
                    <View style={[styles.timeFill, { width: `${Math.min(100, timePct * 100)}%` }]} />
                  </View>
                  <Text style={type.muted}>{new Date(`${goal.due}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </>
              ) : (
                <Text style={styles.big}>{goal.type === 'semanal' ? t('goals.weekCount', { done: p.done, total: p.total }) : t('goals.noDate')}</Text>
              )}
            </View>
          </View>

          <Text style={styles.label}>{t('goal.name')}</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel={t('goal.name')} />

          <Text style={styles.label}>{t('goal.vision')}</Text>
          <TextInput
            value={vision}
            onChangeText={setVision}
            multiline
            placeholder={t('goal.visionPh')}
            placeholderTextColor={colors.faint}
            style={[styles.input, { minHeight: 96, paddingTop: 14 }]}
            textAlignVertical="top"
          />

          <Text style={styles.label}>{t('goal.type')}</Text>
          <View style={styles.row}>
            {(['pronto', 'semanal', 'largo'] as const).map((k) => (
              <Pressable key={k} onPress={() => set({ type: k })} style={[styles.chip, goal.type === k && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: goal.type === k }}>
                <Text style={[styles.chipText, goal.type === k && { color: colors.white }]}>{t(`goal.type.${k}`)}</Text>
              </Pressable>
            ))}
          </View>

          {goal.type === 'semanal' ? (
            <>
              <Text style={styles.label}>{t('goal.perWeek')}</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Pressable key={n} onPress={() => set({ perWeek: n })} style={[styles.chip, goal.perWeek === n && styles.chipOn]}>
                    <Text style={[styles.chipText, goal.perWeek === n && { color: colors.white }]}>{n}×</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.labelRow}>
                <CalendarIcon color={colors.muted} size={15} />
                <Text style={styles.label}>{t('goal.due')}</Text>
              </View>
              <View style={styles.row}>
                {IN_DAYS.map((d) => {
                  const due = addDays(today, d);
                  const on = goal.due === due;
                  return (
                    <Pressable key={d} onPress={() => set({ due })} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && { color: colors.white }]}>{t('goal.inDays', { n: d })}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => set({ due: null })} style={[styles.chip, !goal.due && styles.chipOn]}>
                  <Text style={[styles.chipText, !goal.due && { color: colors.white }]}>{t('goals.noDate')}</Text>
                </Pressable>
              </View>
            </>
          )}

          {p.next.length ? (
            <>
              <View style={styles.labelRow}>
                <TargetIcon color={colors.muted} size={15} />
                <Text style={styles.label}>{t('goal.next')}</Text>
              </View>
              {p.next.slice(0, 4).map((task) => (
                <Text key={task.id} style={styles.step}>
                  {task.title}
                </Text>
              ))}
            </>
          ) : null}

          <Pressable
            onPress={() =>
              Alert.alert(goal.title, t('goals.archiveBody'), [
                { text: t('account.cancel'), style: 'cancel' },
                { text: t('goals.archive'), style: 'destructive', onPress: () => (archiveGoal(goal.id), router.back()) },
              ])
            }
            style={styles.archive}
            accessibilityRole="button"
          >
            <Text style={styles.archiveText}>{t('goals.archive')}</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('task.save')} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, gap: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 12 },
  big: { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.8, color: colors.ink },
  timeBar: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  timeFill: { height: 4, backgroundColor: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  input: { minHeight: 50, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  step: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  archive: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 16 },
  archiveText: { fontFamily: fonts.medium, fontSize: 15, color: colors.danger },
  footer: { paddingHorizontal: 24, paddingBottom: 6 },
});
