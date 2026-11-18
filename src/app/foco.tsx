import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinIcon } from '@/components/Iconos';
import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { estimate } from '@/lib/duraciones';
import { addMinutes, elapsedMs, endFocus, endsAt, pauseFocus, resumeFocus, startFocus, useFoco } from '@/lib/foco';
import { useVoz } from '@/lib/paleta';
import { requiresProof, topThree } from '@/lib/prioridad';
import { todayIso, todayList, useDay } from '@/store/day';
import { colors, fonts } from '@/theme';

const BG = '#0A0A0A';
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

/**
 * Focus session: one task, a countdown, nothing else. Dark and quiet on purpose.
 * The same timer runs on the Lock Screen / Dynamic Island (Live Activity) while the phone is away.
 * "Hecho" asks for the photo first when the task needs proof.
 */
export default function Foco() {
  const params = useLocalSearchParams<{ id?: string }>();
  const tasks = useDay((s) => s.tasks);
  const learned = useDay((s) => s.learned);
  const { toggleItem } = useDay.getState();
  const session = useFoco((s) => s.session);
  const mascot = useMascot();
  const voz = useVoz();
  const [now, setNow] = useState(Date.now());
  const rang = useRef(false);

  // Which task: the one asked for, the one already in focus, or today's first priority.
  const day = todayIso();
  const task =
    tasks.find((x) => x.id === params.id && x.status === 'pendiente') ??
    tasks.find((x) => x.id === session?.taskId && x.status === 'pendiente') ??
    topThree(todayList(tasks), day, useDay.getState().profile.areas)[0];

  useEffect(() => {
    if (!task) return;
    const minutes = estimate(task, learned).minutes;
    startFocus(task, minutes, voz.mic[2], voz.mic[0]);
    // Also tells the learning clock in the store when this started.
    useDay.getState().startFocus(task.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const s = session && task && session.taskId === task.id ? session : null;
  const left = s ? endsAt(s) - (s.pausedAt ?? now) : 0;
  const over = s ? left <= 0 : false;
  const progress = s ? Math.min(1, elapsedMs(s, now) / (s.minutes * 60_000)) : 0;

  useEffect(() => {
    if (over && !rang.current) {
      rang.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (!over) rang.current = false;
  }, [over]);

  if (!task) {
    return (
      <View style={[styles.root, styles.centerAll]}>
        <Text style={styles.title}>{t('focus.nothing')}</Text>
        <Pressable onPress={() => router.replace('/')} style={styles.ghost} accessibilityRole="button">
          <Text style={styles.ghostText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const finish = () => {
    if (requiresProof(task)) {
      router.push({ pathname: '/prueba', params: { id: task.id, from: 'foco' } });
      return;
    }
    const minutes = endFocus();
    // Learn from the real focused time (pauses don't count).
    useDay.setState({ focus: { id: task.id, startedAt: Date.now() - minutes * 60_000 } });
    useDay.getState().markDone(task.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: '/', params: { focused: '1' } });
  };

  const quit = () =>
    Alert.alert(t('focus.quitTitle'), t('focus.quitBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('focus.quit'),
        style: 'destructive',
        onPress: () => {
          endFocus();
          useDay.setState({ focus: null });
          router.replace('/');
        },
      },
    ]);

  const paused = Boolean(s?.pausedAt);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="button" style={styles.pill} hitSlop={8}>
            <Text style={styles.pillText}>{t('focus.minimize')}</Text>
          </Pressable>
          <Text style={styles.headerLabel}>{paused ? t('focus.paused') : t('focus.live')}</Text>
          <Pressable onPress={quit} accessibilityRole="button" style={styles.pill} hitSlop={8}>
            <Text style={styles.pillText}>{t('focus.quit')}</Text>
          </Pressable>
        </View>

        <View style={styles.visual}>
          {mascot.unlocked ? (
            <Mascota seed={mascot.seed} size={170} mood={over ? 'feliz' : 'calma'} />
          ) : (
            <Ondas mode={paused ? 'hecho' : 'calma'} height={220} fadeTo={BG} />
          )}
        </View>

        <View style={styles.center}>
          <Text
            style={[styles.timer, over && { color: voz.mic[0] }]}
            accessibilityRole="timer"
            accessibilityLabel={over ? t('focus.timeUp') : t('focus.left', { time: fmt(left) })}
          >
            {over ? `+${fmt(-left)}` : fmt(left)}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: voz.mic[1] }]} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {task.title}
          </Text>
          {over ? <Text style={styles.sub}>{t('focus.timeUpBody')}</Text> : task.where ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PinIcon color="#9A9A9A" size={15} />
              <Text style={styles.sub}>{task.where}</Text>
            </View>
          ) : null}
          {task.checklist.length ? (
            <View style={styles.chips}>
              {task.checklist.map((i) => (
                <Pressable
                  key={i.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: i.done }}
                  onPress={() => toggleItem(task.id, i.id)}
                  style={[styles.chip, i.done && styles.chipDone]}
                >
                  <Text style={[styles.chipText, i.done && styles.chipTextDone]}>{i.text}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.controls}>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              onPress={() => (paused ? resumeFocus() : pauseFocus())}
              style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.roundText}>{paused ? t('focus.resume') : t('focus.pause')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => addMinutes(5)} style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
              <Text style={styles.roundText}>+5 min</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={finish} style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}>
            <Text style={styles.doneText}>{requiresProof(task) ? t('focus.doneProof') : t('focus.done')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centerAll: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 52 },
  headerLabel: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.4, color: '#8A8A8A', textTransform: 'uppercase' },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#1C1C1C', justifyContent: 'center' },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.white },
  visual: { alignItems: 'center', justifyContent: 'center', height: 220 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 28, gap: 14 },
  timer: { fontFamily: fonts.semibold, fontSize: 76, letterSpacing: -3, color: colors.white, fontVariant: ['tabular-nums'] },
  bar: { width: '70%', height: 4, borderRadius: 2, backgroundColor: '#262626', overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, color: colors.white, textAlign: 'center', marginTop: 6 },
  sub: { fontFamily: fonts.regular, fontSize: 15, color: '#9A9A9A', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#1C1C1C', justifyContent: 'center' },
  chipDone: { backgroundColor: '#141414' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.white },
  chipTextDone: { color: '#5E5E5E', textDecorationLine: 'line-through' },
  controls: { paddingHorizontal: 24, paddingBottom: 8, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  round: { flex: 1, height: 52, borderRadius: 26, backgroundColor: '#1C1C1C', alignItems: 'center', justifyContent: 'center' },
  roundText: { fontFamily: fonts.medium, fontSize: 16, color: colors.white },
  done: { height: 58, borderRadius: 29, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: fonts.semibold, fontSize: 17, color: BG },
  ghost: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  ghostText: { fontFamily: fonts.medium, fontSize: 15, color: colors.white },
});
