import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/Iconos';
import { BackIcon, CloseIcon, IconCircle, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { monthEvents } from '@/lib/calendario';
import { useVoz } from '@/lib/paleta';
import { todayIso, useDay, withDefaults } from '@/store/day';
import { colors, fonts } from '@/theme';

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * The whole month, like a real calendar: small day numbers, a dot where there are tasks (gradient when
 * something important is pending) and a grey dot for calendar events. Tap a day to open it.
 */
export default function Mes() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const today = todayIso();
  const start = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const tasks = useDay((s) => s.tasks);
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

  const perDay: Record<string, { n: number; top: boolean; done: number }> = {};
  for (const x of tasks) {
    const day = x.status === 'hecha' && x.doneOn ? x.doneOn : x.day;
    const c = (perDay[day] ??= { n: 0, top: false, done: 0 });
    if (x.status === 'hecha') c.done++;
    else {
      c.n++;
      if (x.importance === 3 || x.top) c.top = true;
    }
  }

  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' }));
  const shift = (k: number) => setYm(({ y, m }) => ({ y: m + k < 0 ? y - 1 : m + k > 11 ? y + 1 : y, m: (m + k + 12) % 12 }));
  const title = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.monthRow}>
          <Text style={styles.month} accessibilityRole="header">
            {title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconCircle label={t('month.prev')} onPress={() => shift(-1)} size={38}>
              <BackIcon />
            </IconCircle>
            <IconCircle label={t('month.next')} onPress={() => shift(1)} size={38}>
              <ArrowRightIcon size={16} />
            </IconCircle>
          </View>
        </View>

        <View style={styles.grid}>
          {weekdays.map((w, i) => (
            <Text key={`w${i}`} style={styles.weekday}>
              {w.toUpperCase()}
            </Text>
          ))}
          {cells.map((n, i) => {
            if (!n) return <View key={`e${i}`} style={styles.cell} />;
            const day = iso(ym.y, ym.m, n);
            const info = perDay[day];
            const isToday = day === today;
            const past = day < today;
            return (
              <Pressable
                key={day}
                onPress={() => router.push({ pathname: '/agenda', params: { d: day } })}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityLabel={new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              >
                <Animated.View entering={FadeIn.delay(i * 6).duration(200)} style={[styles.dayBox, isToday && styles.today]}>
                  <Text style={[styles.num, past && !isToday && { color: colors.faint }, isToday && { color: colors.white }]}>{n}</Text>
                </Animated.View>
                <View style={styles.dots}>
                  {info?.n ? (
                    <View style={[styles.dot, { backgroundColor: info.top ? voz.mic[1] : colors.ink }]} />
                  ) : info?.done ? (
                    <View style={[styles.dot, { backgroundColor: colors.faint }]} />
                  ) : null}
                  {events[day] ? <View style={[styles.dot, { backgroundColor: colors.line }]} /> : null}
                </View>
              </Pressable>
            );
          })}
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
            <View style={[styles.dot, { backgroundColor: colors.line }]} />
            <Text style={styles.legendText}>{t('month.legendEvents')}</Text>
          </View>
        </View>
        {ym.y !== Number(today.slice(0, 4)) || ym.m !== Number(today.slice(5, 7)) - 1 ? (
          <Pressable onPress={() => setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })} hitSlop={8} accessibilityRole="button">
            <Text style={styles.back}>{t('month.today')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 18 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  month: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1, color: colors.ink, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.muted, paddingBottom: 8 },
  cell: { width: `${100 / 7}%`, height: 58, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  dayBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  today: { backgroundColor: colors.ink },
  num: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 3, height: 8, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  back: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textDecorationLine: 'underline', paddingHorizontal: 4 },
});
