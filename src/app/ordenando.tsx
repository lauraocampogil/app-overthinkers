import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Cargador } from '@/components/Cargador';
import { PrimaryButton, Screen } from '@/components/ui';
import { minutesLabel, t } from '@/i18n';
import type { ParseResult, RawTask } from '@/lib/types';
import { parseBrainDump } from '@/lib/ai';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const MIN_MS = 900;
const CHOICES = [15, 30, 45, 60, 90];
/** An activity with no duration said ("correr", "estudiar"): ask instead of guessing. */
const needsTime = (x: RawTask) => x.minutes === null && (x.askMinutes || x.kind === 'deporte' || x.kind === 'estudio'); // a short beat so it feels sorted, without making anyone wait

export default function Ordenando() {
  // Read the brain dump once: addTasks() clears the draft.
  const draftRef = useRef(useDay.getState().draft);
  const addParsed = useDay((s) => s.addParsed);
  const [empty, setEmpty] = useState(false);
  const [ask, setAsk] = useState<{ result: ParseResult; started: number } | null>(null);
  const [times, setTimes] = useState<Record<number, number | 0>>({});

  const save = (result: ParseResult, started: number) => {
    const added = addParsed(result);
    // A short beat so it feels sorted, then straight to the list with a small confirmation.
    const wait = Math.max(0, MIN_MS - (Date.now() - started));
    setTimeout(() => router.replace({ pathname: '/', params: { added: added.added, today: added.today, later: added.later, goals: added.goals } }), wait);
  };

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      const text = draftRef.current.trim();
      const result: ParseResult = text ? await parseBrainDump(text) : { tasks: [], goals: [], tired: false };
      if (!alive) return;
      if (!result.tasks.length && !result.goals?.length) {
        setEmpty(true);
        return;
      }
      if (result.tasks.some(needsTime)) {
        setAsk({ result, started });
        return;
      }
      save(result, started);
    })();
    return () => {
      alive = false;
    };
  }, [addParsed]);

  if (ask) {
    const list = ask.result.tasks.map((x, i) => ({ x, i })).filter(({ x }) => needsTime(x));
    const done = () => {
      const tasks = ask.result.tasks.map((x, i) => (times[i] ? { ...x, minutes: times[i], askMinutes: false } : x));
      save({ ...ask.result, tasks }, Date.now() - MIN_MS);
    };
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.askBody}>
          <Text style={type.title} accessibilityRole="header">{t('order.howLong')}</Text>
          <Text style={type.muted}>{t('order.howLongBody')}</Text>
          {list.map(({ x, i }, k) => (
            <Animated.View key={i} entering={FadeInDown.delay(k * 70).duration(320)} style={styles.askCard}>
              <Text style={styles.askTitle}>{x.title}</Text>
              <View style={styles.chips}>
                {CHOICES.map((m) => {
                  const on = times[i] === m;
                  return (
                    <Pressable key={m} onPress={() => setTimes((c) => ({ ...c, [i]: on ? 0 : m }))} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <Text style={[styles.chipText, on && { color: colors.white }]}>{minutesLabel(m)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('order.howLongDone')} onPress={done} />
        </View>
      </Screen>
    );
  }

  if (empty) {
    return (
      <Screen style={styles.pad}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
          <Text style={type.title}>{t('order.emptyTitle')}</Text>
          <Text style={type.muted}>{t('order.emptyBody')}</Text>
        </View>
        <PrimaryButton label={t('order.retry')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 32 }}>
        <Cargador />
        <Text style={[type.title, { fontSize: 26, textAlign: 'center' }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {t('order.title')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingBottom: 12 },
  titleBlock: { paddingHorizontal: 24, marginTop: 56, gap: 8 },
  steps: { paddingHorizontal: 44, gap: 14, minHeight: 100, marginBottom: 20 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, flexShrink: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: 12 },
  askBody: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 30, gap: 12 },
  askCard: { padding: 16, borderRadius: 22, backgroundColor: colors.card, gap: 12, marginTop: 4 },
  askTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
});
