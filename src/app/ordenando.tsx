import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ondas } from '@/components/Ondas';
import { CheckIcon, PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { parseBrainDump } from '@/lib/ai';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const MIN_MS = 1800; // long enough to feel the app is thinking for you, short enough not to wait

export default function Ordenando() {
  const draft = useDay((s) => s.draft);
  const buildPlan = useDay((s) => s.buildPlan);
  const [steps, setSteps] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      const result = await parseBrainDump(draft);
      if (!alive) return;
      if (!result.tasks.length) {
        setEmpty(true);
        return;
      }
      const urgent = result.tasks.filter((t) => t.dueInDays !== null && t.dueInDays <= 2);
      const lines = [
        t('order.found', { n: result.tasks.length }),
        urgent.length ? t('order.urgentFirst', { title: urgent[0].title }) : t('order.noUrgent'),
        t(result.tired ? 'order.tired' : 'order.fitted'),
      ];
      lines.forEach((l, i) => setTimeout(() => alive && setSteps((s) => [...s, l]), 350 * (i + 1)));
      buildPlan(result.tasks, result.tired);
      const wait = Math.max(0, MIN_MS - (Date.now() - started));
      setTimeout(() => alive && setReady(true), wait);
    })();
    return () => {
      alive = false;
    };
  }, [draft, buildPlan]);

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
      <View style={styles.titleBlock}>
        <Text style={[type.title, { fontSize: 30, textAlign: 'center' }]} accessibilityRole="header">
          {t('order.title')}
        </Text>
        <Text style={[type.muted, { textAlign: 'center' }]}>{t(ready ? 'order.ready' : 'order.almost')}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Ondas mode="orden" height={300} />
      </View>

      <View style={styles.steps} accessibilityLiveRegion="polite">
        {steps.map((s) => (
          <View key={s} style={styles.step}>
            <CheckIcon />
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label={t('order.cta')} onPress={() => router.replace('/resumen')} disabled={!ready} />
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
