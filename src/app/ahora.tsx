import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Ondas } from '@/components/Ondas';
import { BackIcon, ChevronIcon, IconCircle, PrimaryButton, Screen, TextButton } from '@/components/ui';
import { minutesLabel, t, whyText } from '@/i18n';
import { estimate } from '@/lib/duraciones';
import { todayList, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const Clock = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={colors.muted} strokeWidth={1.8} />
    <Path d="M12 7v5l3 2" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export default function Ahora() {
  const tasks = useDay((s) => s.tasks);
  const markDone = useDay((s) => s.markDone);
  const startFocus = useDay((s) => s.startFocus);
  const learned = useDay((s) => s.learned);
  const [showWhy, setShowWhy] = useState(true);

  // Today's list in order: done ones keep their place in the progress bar.
  const visible = [...todayList(tasks)].sort((a, b) => (a.status === b.status ? 0 : a.status === 'hecha' ? -1 : 1));
  const current = visible.find((t) => t.status === 'pendiente');
  const index = current ? visible.indexOf(current) : visible.length;

  useEffect(() => {
    if (!current && visible.length) router.replace('/hecho');
  }, [current, visible.length]);

  // The clock starts when a task is on screen in focus mode; "Hecho" stops it and GetGo learns your real time.
  useEffect(() => {
    if (current) startFocus(current.id);
  }, [current?.id, startFocus]);

  if (!current) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('now.backToDay')} onPress={() => router.replace('/')}>
          <BackIcon />
        </IconCircle>
        <View style={styles.progress} accessibilityLabel={t('now.label', { i: index + 1, n: visible.length })}>
          {visible.map((task, i) => (
            <View
              key={task.id}
              style={[styles.seg, { backgroundColor: task.status === 'hecha' ? colors.accent : i === index ? colors.ink : '#DEDAF0' }]}
            />
          ))}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ marginTop: 8 }}>
        <Ondas mode="calma" height={170} />
      </View>

      <View style={styles.body}>
        <Text style={type.label}>
          {t('now.label', { i: index + 1, n: visible.length })}
        </Text>
        <Text style={[type.title, { fontSize: 36, lineHeight: 40 }]} accessibilityRole="header">
          {current.title}
        </Text>
        {(() => {
          const est = estimate(current, learned);
          return (
            <View style={styles.time}>
              <Clock />
              <Text style={type.muted}>
                {est.source === 'guess' ? '~' : ''}
                {minutesLabel(est.minutes)}
                {est.source === 'learned' ? ` · ${t('dur.yourAverage')}` : ''}
              </Text>
            </View>
          );
        })()}
        <View style={styles.why}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showWhy }}
            onPress={() => setShowWhy((v) => !v)}
            style={styles.whyHead}
          >
            <Text style={styles.whyTitle}>{t('now.why')}</Text>
            <ChevronIcon down />
          </Pressable>
          {showWhy && <Text style={[type.muted, { lineHeight: 23 }]}>{whyText(current.why)}</Text>}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={t('now.done')}
          onPress={() => {
            markDone(current.id);
            setShowWhy(false);
          }}
        />
        <TextButton label={t('now.cantNow')} onPress={() => router.push({ pathname: '/no-puedo', params: { id: current.id } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, height: 44, marginTop: 8 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  body: { flex: 1, paddingHorizontal: 24, gap: 14 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  why: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  whyHead: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  whyTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  footer: { paddingHorizontal: 24, paddingBottom: 6, gap: 6 },
});
