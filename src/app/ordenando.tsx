import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Cargador } from '@/components/Cargador';
import { PreguntaTiempo } from '@/components/PreguntaTiempo';
import { PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import type { ParseResult, RawTask } from '@/lib/types';
import { parseBrainDump } from '@/lib/ai';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const MIN_MS = 900;
/** An activity with no duration said ("correr", "estudiar"): ask instead of guessing. */
const needsTime = (x: RawTask) => x.minutes === null && (x.askMinutes || x.kind === 'deporte' || x.kind === 'estudio'); // a short beat so it feels sorted, without making anyone wait

export default function Ordenando() {
  // Read the brain dump once: addTasks() clears the draft.
  const draftRef = useRef(useDay.getState().draft);
  const addParsed = useDay((s) => s.addParsed);
  const [empty, setEmpty] = useState(false);
  const [ask, setAsk] = useState<{ result: ParseResult; started: number } | null>(null);

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
    const idx = ask.result.tasks.map((x, i) => (needsTime(x) ? i : -1)).filter((i) => i >= 0);
    return (
      <PreguntaTiempo
        titles={idx.map((i) => ask.result.tasks[i].title)}
        onDone={(mins) => {
          const tasks = ask.result.tasks.map((x, i) => {
            const k = idx.indexOf(i);
            const m = k >= 0 ? mins[k] : null;
            return m ? { ...x, minutes: m, askMinutes: false } : x;
          });
          save({ ...ask.result, tasks }, Date.now() - MIN_MS);
        }}
      />
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
