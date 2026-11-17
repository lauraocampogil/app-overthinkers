import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronIcon } from '@/components/ui';
import { t, type Key } from '@/i18n';
import { addDays } from '@/lib/planner';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const REASONS: Key[] = ['cant.energy', 'cant.time', 'cant.overwhelmed', 'cant.other'];

export default function NoPuedo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useDay((s) => s.tasks.find((t) => t.id === id));
  const { shrink, moveTo, remove } = useDay.getState();
  const postpone = (taskId: string) => moveTo(taskId, addDays(todayIso(), 1));
  const drop = remove;
  const [reason, setReason] = useState<Key>('cant.energy');
  const insets = useSafeAreaInsets();

  const act = (fn: (id: string) => void) => {
    if (id) fn(id);
    router.back();
  };

  const full = task?.minutes ?? null;
  const half = full !== null ? Math.max(5, Math.round(full / 2 / 5) * 5) : null;

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={{ gap: 6 }}>
          <Text style={[type.title, { fontSize: 28, lineHeight: 32 }]} accessibilityRole="header">{t('cant.title')}</Text>
          <Text style={type.muted}>{t('cant.question')}</Text>
        </View>

        <View style={styles.chips} accessibilityRole="radiogroup">
          {REASONS.map((r) => {
            const on = r === reason;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setReason(r)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && { color: colors.white, fontFamily: fonts.medium }]}>{t(r)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View>
          <Option title={t('cant.smaller')} subtitle={full !== null && half !== null ? t('cant.smallerSub', { half, full }) : t('cant.smallerStep')} onPress={() => act(shrink)} />
          <Option title={t('cant.tomorrow')} subtitle={t('cant.tomorrowSub')} onPress={() => act(postpone)} />
          <Option title={t('cant.notNeeded')} onPress={() => act(drop)} last />
        </View>
      </View>
    </View>
  );
}

function Option({ title, subtitle, onPress, last }: { title: string; subtitle?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.option, last && { borderBottomWidth: 1 }]}>
      <View style={{ gap: 2 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle && <Text style={[type.muted, { fontSize: 14 }]}>{subtitle}</Text>}
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,26,61,0.3)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, gap: 20 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#DEDAF0', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#EEEBF8' },
  optionTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
});
