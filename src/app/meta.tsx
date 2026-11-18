import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Anillo } from '@/components/Anillo';
import { CalendarIcon, CameraIcon, ChartIcon, TargetIcon } from '@/components/Iconos';
import { keepPhoto } from '@/lib/fotos';
import { isWeightGoal } from '@/lib/retos';
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
            <Anillo progress={p.pct} size={96} stroke={7} color={voz.mic[1]} label={`${Math.round(p.pct * 100)}%`} />
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

          {(() => {
            const list = goal.checkins ?? [];
            const weights = list.filter((c) => typeof c.value === 'number') as { date: string; value: number }[];
            const photos = list.filter((c) => c.photo);
            const W = 300, H = 110;
            const vals = weights.map((w) => w.value);
            const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5;
            const pts = weights.map((w, i) => [weights.length === 1 ? W / 2 : (i / (weights.length - 1)) * (W - 16) + 8, H - 8 - ((w.value - lo) / (hi - lo || 1)) * (H - 16)]);
            const diff = weights.length > 1 ? weights[weights.length - 1].value - weights[0].value : 0;
            return (
              <View style={styles.track}>
                <View style={styles.labelRow}>
                  <ChartIcon color={colors.muted} size={15} />
                  <Text style={[styles.label, { marginTop: 0 }]}>{t('checkin.history')}</Text>
                </View>
                {weights.length ? (
                  <>
                    <Text style={styles.big}>
                      {weights[weights.length - 1].value.toLocaleString(locale)} kg
                      {weights.length > 1 ? <Text style={styles.diff}>{`  ${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} kg`}</Text> : null}
                    </Text>
                    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
                      <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={voz.mic[1]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                      {pts.map((p, i) => (
                        <Circle key={i} cx={p[0]} cy={p[1]} r={4} fill={colors.white} stroke={voz.mic[2]} strokeWidth={2} />
                      ))}
                    </Svg>
                  </>
                ) : (
                  <Text style={type.muted}>{isWeightGoal(goal) ? t('checkin.noWeight') : t('checkin.noPhotos')}</Text>
                )}
                {photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {photos.map((c) => (
                      <View key={c.date} style={{ gap: 4 }}>
                        <Image source={{ uri: c.photo }} style={styles.thumb} accessibilityIgnoresInvertColors />
                        <Text style={styles.thumbDate}>{new Date(`${c.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
                <Pressable
                  onPress={async () => {
                    const uri = await keepPhoto(`progress-${goal.id}-${today}`);
                    if (uri) useDay.getState().addCheckin(goal.id, { photo: uri });
                  }}
                  style={styles.photoBtn}
                  accessibilityRole="button"
                >
                  <CameraIcon size={18} />
                  <Text style={styles.chipText}>{t('checkin.photo')}</Text>
                </Pressable>
              </View>
            );
          })()}

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
  track: { padding: 16, borderRadius: 22, backgroundColor: colors.card, gap: 10, marginBottom: 6 },
  diff: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted },
  thumb: { width: 88, height: 116, borderRadius: 14, backgroundColor: colors.white },
  thumbDate: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, textAlign: 'center' },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: colors.white },
  archive: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 16 },
  archiveText: { fontFamily: fonts.medium, fontSize: 15, color: colors.danger },
  footer: { paddingHorizontal: 24, paddingBottom: 6 },
});
