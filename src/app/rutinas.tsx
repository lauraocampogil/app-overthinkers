import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SemanaFija } from '@/components/SemanaFija';
import { BackIcon, IconCircle, Screen } from '@/components/ui';
import { minutesLabel, t } from '@/i18n';
import { defaultRoutine, routineOf } from '@/lib/rutinas';
import type { Routine, RoutineKind, RoutineStep } from '@/lib/types';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const TIMES: Record<RoutineKind, string[]> = {
  manana: ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'],
  noche: ['20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'],
};
const MINUTES = [2, 5, 10, 15, 20, 30];

/** Edit the morning and night routines: on/off, time, and the steps. */
export default function Rutinas() {
  const routines = useDay((s) => s.routines);
  const setRoutine = useDay((s) => s.setRoutine);
  const areas = useDay((s) => s.profile.areas);
  // Opened from one routine ("Editar" on the night routine): show only that one.
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const only: RoutineKind | null = kindParam === 'manana' || kindParam === 'noche' ? kindParam : null;
  const fixed = useDay((s) => s.profile.fixed);

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.back')} onPress={() => router.back()}>
          <BackIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={type.title} accessibilityRole="header">
          {t('routine.title')}
        </Text>
        <Text style={type.muted}>{t('routine.intro')}</Text>
        {(only ? [only] : (['manana', 'noche'] as RoutineKind[])).map((kind) => (
          <Editor
            key={kind}
            kind={kind}
            routine={routineOf(routines, kind)}
            ideas={defaultRoutine(kind, areas.map((a) => a.id)).steps}
            onChange={(r) => setRoutine(kind, r)}
          />
        ))}
        {!only ? (
          <>
            <Text style={[type.title, { fontSize: 26, marginTop: 18 }]} accessibilityRole="header">
              {t('ob.weekTitle')}
            </Text>
            <Text style={type.muted}>{t('fixed.intro')}</Text>
            <SemanaFija items={fixed ?? []} onChange={(items) => useDay.getState().setFixed(items)} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Editor({ kind, routine, ideas, onChange }: { kind: RoutineKind; routine: Routine; ideas: RoutineStep[]; onChange: (r: Routine) => void }) {
  // GetGo's proposals that are not in the routine yet: one tap accepts them, ignoring them is fine.
  const proposals = ideas.filter((idea) => !routine.steps.some((x) => x.id === idea.id || x.text.toLowerCase() === idea.text.toLowerCase()));
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const update = (patch: Partial<Routine>) => onChange({ ...routine, ...patch });
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    update({ steps: [...routine.steps, { id: `${kind}-${Date.now().toString(36)}`, text, minutes: 5 }] });
    setDraft('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{t(`routine.${kind}`)}</Text>
        <Switch
          value={routine.enabled}
          onValueChange={(enabled) => update({ enabled })}
          trackColor={{ true: colors.ink, false: colors.line }}
          accessibilityLabel={t(`routine.${kind}`)}
        />
      </View>
      {routine.enabled ? (
        <>
          <Text style={type.label}>{t('routine.reminder')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {TIMES[kind].map((h) => (
              <Pressable key={h} onPress={() => update({ at: h })} style={[styles.chip, routine.at === h && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: routine.at === h }}>
                <Text style={[styles.chipText, routine.at === h && styles.chipTextOn]}>{h}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {routine.steps.map((step, i) => (
            <View key={step.id} style={styles.stepWrap}>
              <View style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <TextInput
                  value={step.text}
                  onChangeText={(text) => update({ steps: routine.steps.map((x) => (x.id === step.id ? { ...x, text } : x)) })}
                  style={styles.stepInput}
                  accessibilityLabel={t('routine.stepName')}
                />
                <Pressable onPress={() => setOpen(open === step.id ? null : step.id)} hitSlop={6} accessibilityRole="button">
                  <Text style={styles.stepMins}>{minutesLabel(step.minutes)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => update({ steps: routine.steps.filter((x) => x.id !== step.id) })}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('routine.remove')}
                >
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              </View>
              {open === step.id ? (
                <View style={[styles.chips, { paddingLeft: 30 }]}>
                  {MINUTES.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => {
                        update({ steps: routine.steps.map((x) => (x.id === step.id ? { ...x, minutes: m } : x)) });
                        setOpen(null);
                      }}
                      style={[styles.chip, step.minutes === m && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, step.minutes === m && styles.chipTextOn]}>{minutesLabel(m)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            blurOnSubmit={false}
            returnKeyType="done"
            placeholder={t('routine.addStep')}
            placeholderTextColor={colors.faint}
            style={styles.add}
          />
          {proposals.length ? (
            <>
              <Text style={[type.label, { marginTop: 6 }]}>{t('routine.ideas')}</Text>
              <View style={styles.chips}>
                {proposals.map((idea) => (
                  <Pressable
                    key={idea.id}
                    onPress={() => update({ steps: [...routine.steps, idea] })}
                    style={styles.idea}
                    accessibilityRole="button"
                    accessibilityLabel={t('routine.accept', { step: idea.text })}
                  >
                    <Text style={styles.ideaText}>+ {idea.text}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60, gap: 14 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 18, gap: 10, marginTop: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.4, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.white },
  stepWrap: { gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.white },
  stepNum: { width: 18, fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  stepInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: 8 },
  stepMins: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  remove: { fontFamily: fonts.regular, fontSize: 22, color: colors.faint, paddingHorizontal: 4 },
  idea: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  ideaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  add: { minHeight: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
});
