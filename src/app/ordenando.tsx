import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Cargador } from '@/components/Cargador';
import { PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { parseBrainDump } from '@/lib/ai';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const MIN_MS = 900; // a short beat so it feels sorted, without making anyone wait

export default function Ordenando() {
  // Read the brain dump once: addTasks() clears the draft.
  const draftRef = useRef(useDay.getState().draft);
  const addParsed = useDay((s) => s.addParsed);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      const text = draftRef.current.trim();
      const result = text ? await parseBrainDump(text) : { tasks: [], goals: [] };
      if (!alive) return;
      if (!result.tasks.length && !result.goals?.length) {
        setEmpty(true);
        return;
      }
      const added = addParsed(result);
      // A short beat so it feels sorted, then straight to the list with a small confirmation.
      const wait = Math.max(0, MIN_MS - (Date.now() - started));
      setTimeout(() => {
        if (alive) router.replace({ pathname: '/', params: { added: added.added, today: added.today, later: added.later, goals: added.goals } });
      }, wait);
    })();
    return () => {
      alive = false;
    };
  }, [addParsed]);

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
});
