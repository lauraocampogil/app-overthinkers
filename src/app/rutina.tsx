import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { CheckIcon, CloseIcon, IconCircle, Screen } from '@/components/ui';
import { minutesLabel, t } from '@/i18n';
import { useVoz } from '@/lib/paleta';
import { routineMinutes, routineNow, routineOf } from '@/lib/rutinas';
import type { RoutineKind } from '@/lib/types';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** Run through the morning or night routine: tick each step, the ring fills up. */
export default function Rutina() {
  const params = useLocalSearchParams<{ kind?: RoutineKind }>();
  const kind: RoutineKind = params.kind === 'noche' || params.kind === 'manana' ? params.kind : routineNow() ?? 'manana';
  const routine = routineOf(useDay((s) => s.routines), kind);
  const done = useDay((s) => s.routineLog[todayIso()]?.[kind] ?? []);
  const toggle = useDay((s) => s.toggleRoutineStep);
  const voz = useVoz();

  const count = routine.steps.filter((x) => done.includes(x.id)).length;
  const all = routine.steps.length > 0 && count === routine.steps.length;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
        <Pressable accessibilityRole="button" onPress={() => router.push('/rutinas')} style={styles.edit} hitSlop={8}>
          <Text style={styles.editText}>{t('routine.edit')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.top}>
          <Anillo progress={routine.steps.length ? count / routine.steps.length : 0} size={84} stroke={7} color={voz.mic[1]} label={`${count}/${routine.steps.length}`} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={type.title} accessibilityRole="header">
              {t(`routine.${kind}`)}
            </Text>
            <Text style={type.muted}>
              {all ? t('routine.allDone') : t('routine.length', { time: minutesLabel(routineMinutes(routine)) })}
            </Text>
          </View>
        </View>

        {routine.steps.map((step, i) => {
          const on = done.includes(step.id);
          return (
            <Pressable
              key={step.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                toggle(kind, step.id);
              }}
              style={({ pressed }) => [styles.step, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.num, on && styles.numOn]}>
                {on ? <CheckIcon color={colors.white} size={14} /> : <Text style={styles.numText}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepText, on && styles.stepDone]}>{step.text}</Text>
              <Text style={styles.mins}>{minutesLabel(step.minutes)}</Text>
            </Pressable>
          );
        })}
        {!routine.steps.length ? <Text style={type.muted}>{t('routine.empty')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 52, marginTop: 4 },
  edit: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.card, justifyContent: 'center' },
  editText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.card },
  num: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  numOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  numText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  stepText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  stepDone: { color: colors.faint, textDecorationLine: 'line-through' },
  mins: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
