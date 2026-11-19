import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { NavChevron, CloseIcon, IconCircle, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { monthEvents } from '@/lib/calendario';
import { useVoz } from '@/lib/paleta';
import { todayIso, useDay, withDefaults } from '@/store/day';
import { colors, fonts } from '@/theme';

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The whole month, like a real calendar. Each day carries one quiet mark:
 * its photo (proof or check-in) if there is one, otherwise a dot — colour for a pending priority,
 * black for pending tasks, grey for calendar events only. Tap a day to open it.
 */
export default function Mes() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const today = todayIso();
  const start = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const tasks = useDay((s) => s.tasks);
  const goals = useDay((s) => s.goals);
  const settings = withDefaults(useDay((s) => s.settings));
  const voz = useVoz();
  const [events, setEvents] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    void monthEvents(settings, ym.y, ym.m).then((e) => alive && setEvents(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym.y, ym.m]);

  const first = new Date(ym.y, ym.m, 1);
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const perDay: Record<string, { n: number; top: boolean; done: number; photo?: string }> = {};
  for (const x of tasks) {
    const day = x.status === 'hecha' && x.doneOn ? x.doneOn : x.day;
    const c = (perDay[day] ??= { n: 0, top: false, done: 0 });
    if (x.status === 'hecha') {
      c.done++;
      if (x.proofPhoto && !c.photo) c.photo = x.proofPhoto;
    } else {
      c.n++;
      if (x.importance === 3 || x.top) c.top = true;
    }
  }
  for (const g of goals) for (const ci of g.checkins ?? []) if (ci.photo) (perDay[ci.date] ??= { n: 0, top: false, done: 0 }).photo ??= ci.photo;

  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' }));
  const shift = (k: number) => setYm(({ y, m }) => ({ y: m + k < 0 ? y - 1 : m + k > 11 ? y + 1 : y, m: (m + k + 12) % 12 }));
  const monthName = cap(first.toLocaleDateString(locale, { month: 'long' }));
  const isThisMonth = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7)) - 1;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
        <View style={styles.nav}>
          <IconCircle label={t('month.prev')} onPress={() => shift(-1)} size={40}>
            <NavChevron dir="left" />
          </IconCircle>
          <IconCircle label={t('month.next')} onPress={() => shift(1)} size={40}>
            <NavChevron dir="right" />
          </IconCircle>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.month} accessibilityRole="header">
            {monthName}
          </Text>
          <Text style={styles.year}>{ym.y}</Text>
          {!isThisMonth ? (
            <Pressable onPress={() => setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })} hitSlop={8} accessibilityRole="button" style={styles.todayPill}>
              <Text style={styles.todayPillText}>{t('due.today')}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            {weekdays.map((w, i) => (
              <Text key={`w${i}`} style={[styles.weekday, i >= 5 && { color: colors.faint }]}>
                {w.toUpperCase()}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((n, i) => {
              if (!n) return <View key={`e${i}`} style={styles.cell} />;
              const day = iso(ym.y, ym.m, n);
              const info = perDay[day];
              const isToday = day === today;
              const past = day < today;
              const dot = info?.n ? (info.top ? voz.mic[1] : colors.ink) : events[day] ? colors.faint : null;
              return (
                <Pressable
                  key={day}
                  onPress={() => router.push({ pathname: '/agenda', params: { d: day } })}
                  style={({ pressed }) => [styles.cell, pressed && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel={new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                >
                  <Animated.View entering={FadeIn.delay(i * 5).duration(180)} style={[styles.dayBox, isToday && styles.today]}>
                    {info?.photo ? (
                      <>
                        <Image source={{ uri: info.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        <View style={[StyleSheet.absoluteFill, styles.photoShade]} />
                      </>
                    ) : null}
                    <Text
                      style={[
                        styles.num,
                        past && !isToday && !info?.photo && { color: colors.faint },
                        (isToday || info?.photo) && { color: colors.white },
                      ]}
                    >
                      {n}
                    </Text>
                  </Animated.View>
                  <View style={[styles.dot, dot ? { backgroundColor: dot } : null]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: voz.mic[1] }]} />
            <Text style={styles.legendText}>{t('month.legendTop')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.ink }]} />
            <Text style={styles.legendText}>{t('month.legendTasks')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.faint }]} />
            <Text style={styles.legendText}>{t('month.legendEvents')}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  nav: { flexDirection: 'row', gap: 8 },
  // Plenty of room on this screen: the month starts well below the buttons and breathes.
  body: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 40, gap: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 6 },
  month: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1.2, color: colors.ink },
  year: { fontFamily: fonts.medium, fontSize: 22, letterSpacing: -0.5, color: colors.faint, flex: 1 },
  todayPill: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, justifyContent: 'center', alignSelf: 'center' },
  todayPillText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  card: { borderRadius: 28, backgroundColor: colors.card, paddingVertical: 14, paddingHorizontal: 6 },
  row: { flexDirection: 'row', marginBottom: 6 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 62, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  dayBox: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  today: { backgroundColor: colors.ink },
  photoShade: { backgroundColor: 'rgba(0,0,0,0.25)' },
  num: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, paddingHorizontal: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
