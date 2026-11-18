import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Cargador } from '@/components/Cargador';
import { SunIcon } from '@/components/Iconos';
import { CloseIcon, IconCircle, MicIcon, PrimaryButton, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { lastWeekError, planWeek, type WeekPlan } from '@/lib/ai';
import { useVoz } from '@/lib/paleta';
import { addDays } from '@/lib/planner';
import type { RawTask } from '@/lib/types';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * "Planificar mi semana": tell GetGo what the week should hold (gym, dishes, cooking, football at 19:00…),
 * it spreads everything over the 7 days with hours, marks the priorities and gives advice (when to get up).
 * Nothing is saved until the person accepts the plan.
 */
export default function Semana() {
  const { review } = useLocalSearchParams<{ review?: string }>();
  const voz = useVoz();
  const [text, setText] = useState(() => (review ? useDay.getState().draft : ''));
  const [phase, setPhase] = useState<'input' | 'thinking' | 'review' | 'failed'>(review ? 'thinking' : 'input');
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [useWake, setUseWake] = useState(true);
  const started = useRef(false);
  const today = todayIso();

  const run = async (value: string) => {
    if (!value.trim()) return;
    setPhase('thinking');
    const res = await planWeek(value.trim());
    if (!res || !res.tasks.length) {
      setPhase('failed');
      return;
    }
    setPlan(res);
    setPhase('review');
  };

  useEffect(() => {
    if (review && !started.current) {
      started.current = true;
      useDay.getState().setDraft('');
      void run(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  const save = () => {
    if (!plan) return;
    const store = useDay.getState();
    if (plan.wake && useWake) {
      store.setProfile({ wake: plan.wake });
      store.setSettings({ dayStart: plan.wake });
    }
    const added = store.addParsed({ tasks: plan.tasks, goals: plan.goals }, { pinDays: true });
    useDay.setState({ weekPlannedOn: today });
    router.replace({ pathname: '/', params: { added: added.added, today: added.today, later: added.later, goals: added.goals } });
  };
  const setMinutes = (task: RawTask, m: number) => setPlan((p) => (p ? { ...p, tasks: p.tasks.map((x) => (x === task ? { ...x, minutes: m, askMinutes: false } : x)) } : p));
  const removeTask = (task: RawTask) => setPlan((p) => (p ? { ...p, tasks: p.tasks.filter((x) => x !== task) } : p));

  if (phase === 'thinking') {
    return (
      <Screen>
        <View style={styles.center}>
          <Cargador />
          <Text style={[type.title, { fontSize: 26, textAlign: 'center' }]}>{t('week.thinking')}</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'review' && plan) {
    const days = Array.from({ length: 7 }, (_, i) => i);
    return (
      <Screen>
        <View style={styles.header}>
          <IconCircle label={t('common.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconCircle>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={type.title} accessibilityRole="header">
            {t('week.reviewTitle')}
          </Text>
          {plan.advice || plan.wake ? (
            <View style={styles.advice}>
              <SunIcon size={20} color={colors.white} />
              <View style={{ flex: 1, gap: 8 }}>
                {plan.advice ? <Text style={styles.adviceText}>{plan.advice}</Text> : null}
                {plan.wake ? (
                  <View style={styles.wakeRow}>
                    <Text style={styles.wakeText}>{t('week.wake', { time: plan.wake })}</Text>
                    <Switch value={useWake} onValueChange={setUseWake} trackColor={{ true: colors.white, false: '#3A3A3A' }} thumbColor={useWake ? colors.ink : undefined} />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {days.map((i) => {
            const list = plan.tasks.filter((x) => (x.dueInDays ?? 0) === i).sort((a, b) => (a.at ?? '99').localeCompare(b.at ?? '99'));
            const day = addDays(today, i);
            return (
              <View key={i} style={styles.day}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayName}>{i === 0 ? t('due.today') : new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric' })}</Text>
                  <Text style={styles.count}>{list.length}</Text>
                </View>
                {list.length ? (
                  list.map((task, k) => (
                    <View key={`${task.title}${k}`} style={styles.row}>
                      <Text style={styles.time}>{task.at ?? '—'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{task.title}</Text>
                        <Text style={styles.meta}>{[task.minutes ? minutesLabel(task.minutes) : '', task.where ?? ''].filter(Boolean).join(' · ')}</Text>
                        {!task.minutes && task.askMinutes ? (
                          <View style={styles.timeChips}>
                            <Text style={styles.meta}>{t('order.howLong')}</Text>
                            {[15, 30, 45, 60, 90].map((m) => (
                              <Pressable key={m} onPress={() => setMinutes(task, m)} style={styles.timeChip} hitSlop={4} accessibilityRole="button">
                                <Text style={styles.timeChipText}>{minutesLabel(m)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      {task.importance === 3 ? <View style={styles.prio}><Text style={styles.prioText}>{t('week.priority')}</Text></View> : null}
                      <Pressable onPress={() => removeTask(task)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('task.delete')}>
                        <Text style={styles.remove}>×</Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text style={styles.meta}>{t('hoy.colEmpty')}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('week.save')} onPress={save} />
          <Pressable onPress={() => setPhase('input')} style={styles.again} accessibilityRole="button">
            <Text style={styles.againText}>{t('week.change')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <IconCircle label={t('common.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconCircle>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={type.title} accessibilityRole="header">
            {t('week.title')}
          </Text>
          <Text style={type.muted}>{t('week.body')}</Text>
          {phase === 'failed' ? (
            <View style={{ gap: 4 }}>
              <Text style={[type.muted, { color: colors.danger }]}>{t('week.failed')}</Text>
              {lastWeekError ? <Text style={styles.meta}>{lastWeekError}</Text> : null}
            </View>
          ) : null}
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={t('week.placeholder')}
            placeholderTextColor={colors.faint}
            style={styles.input}
            textAlignVertical="top"
          />
          <Pressable onPress={() => router.push({ pathname: '/escuchando', params: { to: 'semana' } })} style={styles.voice} accessibilityRole="button" accessibilityLabel={t('week.speak')}>
            <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mic}>
              <MicIcon />
            </LinearGradient>
            <Text style={styles.voiceText}>{t('week.speak')}</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('week.cta')} onPress={() => void run(text)} disabled={text.trim().length < 5} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 32, paddingHorizontal: 24 },
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 150, gap: 12 },
  input: { minHeight: 180, padding: 16, borderRadius: 20, backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink, marginTop: 8 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', marginTop: 4 },
  mic: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  advice: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 22, backgroundColor: colors.ink, marginTop: 4 },
  adviceText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.white },
  wakeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  wakeText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: '#D6D6D6' },
  day: { padding: 16, borderRadius: 22, backgroundColor: colors.card, gap: 4 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  dayName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, textTransform: 'capitalize' },
  count: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  time: { width: 46, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  prio: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: colors.ink, justifyContent: 'center' },
  prioText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.white, letterSpacing: 0.3 },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  timeChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.white, justifyContent: 'center' },
  timeChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  remove: { fontFamily: fonts.regular, fontSize: 22, color: colors.faint, paddingHorizontal: 4 },
  // Floats over the list with nothing behind it, so the days stay visible under the button.
  footer: { position: 'absolute', left: 0, right: 0, bottom: 6, paddingHorizontal: 20, gap: 4 },
  again: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  againText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});
