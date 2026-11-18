import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { useMascot } from '@/lib/auth';
import { PrimaryButton, Screen } from '@/components/ui';
import { t, weekdayLetter } from '@/i18n';
import { isoDay } from '@/lib/streak';
import { todayList, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

export default function Hecho() {
  const tasks = useDay((s) => s.tasks);
  const streak = useDay((s) => s.streak);
  const visible = todayList(tasks);
  const done = visible.filter((t) => t.status === 'hecha').length;

  // Last 7 days, today on the right. A day is filled if it falls inside the current streak.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const last = streak.lastCountedDate;
    const back = last ? Math.round((Date.parse(`${last}T12:00:00`) - Date.parse(`${isoDay(d)}T12:00:00`)) / 86_400_000) : -1;
    return { letter: weekdayLetter(d), filled: back >= 0 && back < streak.current, today: i === 6 };
  });

  const mascot = useMascot();

  return (
    <Screen>
      <View style={{ marginTop: 48 }}>
        {mascot.unlocked ? <Mascota seed={mascot.seed} size={240} mood="feliz" /> : <Ondas mode="hecho" height={300} />}
      </View>
      <View style={styles.text}>
        <Text style={[type.title, { textAlign: 'center' }]} accessibilityRole="header">{t('finished.title')}</Text>
        <Text style={[type.muted, { textAlign: 'center' }]}>
          {t('finished.stats', { n: streak.current, done, total: visible.length })}
        </Text>
      </View>
      <View style={styles.week} accessibilityLabel={t('finished.week', { n: days.filter((d) => d.filled).length })}>
        {days.map((d, i) => (
          <View key={i} style={styles.day}>
            <Text style={styles.letter}>{d.letter}</Text>
            <View
              style={[
                styles.dot,
                { backgroundColor: d.filled ? colors.accent : colors.line },
                d.today && { borderWidth: 3, borderColor: colors.bgTop, outlineColor: colors.accent, outlineWidth: 1, outlineStyle: 'solid' },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={styles.footer}>
        <PrimaryButton label={t('finished.cta')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { paddingHorizontal: 24, marginTop: 8, gap: 8 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, marginHorizontal: 24 },
  day: { alignItems: 'center', gap: 8 },
  letter: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  dot: { width: 28, height: 28, borderRadius: 14 },
  footer: { paddingHorizontal: 24, paddingBottom: 12 },
});
