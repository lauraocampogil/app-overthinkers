import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackIcon, IconCircle, Screen } from '@/components/ui';
import { locale, t, weekdayLetter } from '@/i18n';
import { isoDay } from '@/lib/streak';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

type Cell = { key: string; day: number | null; state: 'done' | 'freeze' | 'missed' | 'future' | 'empty'; today: boolean };

function monthCells(history: Record<string, 'done' | 'freeze'>, now = new Date()): Cell[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const todayIso = isoDay(now);
  const cells: Cell[] = Array.from({ length: lead }, (_, i) => ({ key: `e${i}`, day: null, state: 'empty', today: false }));
  for (let d = 1; d <= days; d++) {
    const iso = isoDay(new Date(y, m, d));
    const h = history[iso];
    const state: Cell['state'] = h ?? (iso > todayIso ? 'future' : 'missed');
    cells.push({ key: iso, day: d, state, today: iso === todayIso });
  }
  return cells;
}

// A Monday, to print the weekday letters in the phone's language.
const MONDAY = new Date(2024, 0, 1);
const weekLetters = Array.from({ length: 7 }, (_, i) => weekdayLetter(new Date(2024, 0, MONDAY.getDate() + i)));

export default function Racha() {
  const streak = useDay((s) => s.streak);
  const history = useDay((s) => s.history);
  const cells = monthCells(history);
  const monthName = new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.back')} onPress={() => router.back()}>
          <BackIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={type.title} accessibilityRole="header">{t('streak.title')}</Text>

        <View style={styles.hero} accessible accessibilityLabel={`${streak.current} ${t('streak.days', { n: streak.current })}`}>
          <Text style={styles.big}>{streak.current}</Text>
          <Text style={type.muted}>{t('streak.days', { n: streak.current })}</Text>
        </View>

        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{streak.best ?? streak.current}</Text>
            <Text style={styles.cardLabel}>{t('streak.best')}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardValue}>{streak.freezes}</Text>
            <Text style={styles.cardLabel}>{t('streak.freezes')}</Text>
          </View>
        </View>
        <Text style={[type.muted, { fontSize: 14 }]}>{t('streak.freezesHint')}</Text>

        <View style={styles.calendar}>
          <Text style={styles.month}>{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</Text>
          <View style={styles.grid}>
            {weekLetters.map((l, i) => (
              <Text key={`w${i}`} style={styles.weekday}>{l}</Text>
            ))}
            {cells.map((c) => (
              <View key={c.key} style={styles.cellWrap}>
                {c.day !== null && (
                  <View
                    style={[
                      styles.cell,
                      c.state === 'done' && { backgroundColor: colors.accent },
                      c.state === 'freeze' && { backgroundColor: '#9A9A9A' },
                      c.state === 'missed' && { backgroundColor: colors.soft },
                      c.state === 'future' && { borderWidth: 1, borderColor: colors.line },
                      c.today && { borderWidth: 2, borderColor: colors.ink },
                    ]}
                  >
                    <Text style={[styles.cellText, c.state === 'done' && { color: colors.white }]}>{c.day}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>{t('streak.legendDone')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#9A9A9A' }]} />
              <Text style={styles.legendText}>{t('streak.legendFreeze')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, marginTop: 8, height: 44 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 18 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  big: { fontFamily: fonts.medium, fontSize: 88, lineHeight: 96, letterSpacing: -3, color: colors.accentDark },
  cards: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: colors.card, gap: 2 },
  cardValue: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  cardLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  calendar: { padding: 16, borderRadius: 24, backgroundColor: colors.card, gap: 12 },
  month: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginBottom: 6 },
  cellWrap: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cell: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
