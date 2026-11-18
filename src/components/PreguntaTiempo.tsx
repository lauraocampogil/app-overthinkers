import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { MascotaMarca } from '@/components/Logo';
import { Mascota } from '@/components/Mascota';
import { MicIcon, Screen } from '@/components/ui';
import { lang, locale, minutesLabel, t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { parseDuration } from '@/lib/tiempo';
import { liveSpeechAvailable, pickLocale, requestLivePermission, startLive, type LiveSession } from '@/lib/voz';
import { colors, fonts } from '@/theme';

const CHOICES = [15, 30, 45, 60, 90];

/**
 * GetGo asks "¿Cuánto tiempo?" for each activity the person didn't give a duration for, one at a time,
 * with the mascot. Answer by tapping, or by saying it ("media hora", "una hora y media").
 */
export function PreguntaTiempo({ titles, onDone }: { titles: string[]; onDone: (minutes: (number | null)[]) => void }) {
  const mascot = useMascot();
  const voz = useVoz();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => titles.map(() => null));
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const session = useRef<LiveSession | null>(null);
  const canSpeak = liveSpeechAvailable();

  const answer = (m: number | null) => {
    session.current?.cancel();
    session.current = null;
    setListening(false);
    setHeard('');
    void Haptics.selectionAsync().catch(() => {});
    const next = answers.map((a, k) => (k === i ? m : a));
    setAnswers(next);
    if (i + 1 >= titles.length) onDone(next);
    else setI(i + 1);
  };

  const listen = async () => {
    if (listening) {
      session.current?.cancel();
      setListening(false);
      return;
    }
    if (!(await requestLivePermission())) return;
    const speechLocale = await pickLocale(locale, lang);
    setHeard('');
    setListening(true);
    let taken = false;
    const mine = startLive(speechLocale, {
      onText: (text) => {
        if (taken || session.current !== mine) return;
        setHeard(text);
        const m = parseDuration(text);
        // As soon as a duration is heard, take it (a short beat so the person sees it).
        if (m) {
          taken = true;
          setTimeout(() => session.current === mine && answer(m), 450);
        }
      },
      onLevel: () => {},
      onError: () => setListening(false),
    });
    session.current = mine;
  };

  useEffect(() => () => session.current?.cancel(), []);

  const title = titles[i] ?? '';
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.count}>
          {i + 1}/{titles.length}
        </Text>
        <View style={styles.mascot}>
          {mascot.unlocked ? <Mascota seed={mascot.seed} size={150} mood={listening ? 'escucha' : 'calma'} /> : <MascotaMarca size={150} />}
        </View>
        <Animated.View key={i} entering={FadeInDown.duration(320)} style={styles.bubble}>
          <Text style={styles.question} accessibilityRole="header">
            {t('order.howLongFor', { task: title.charAt(0).toLowerCase() + title.slice(1) })}
          </Text>
        </Animated.View>
        {heard ? (
          <Animated.Text entering={FadeIn} style={styles.heard}>
            “{heard}”
          </Animated.Text>
        ) : null}
        <View style={styles.chips}>
          {CHOICES.map((m) => (
            <Pressable key={m} onPress={() => answer(m)} style={({ pressed }) => [styles.chip, pressed && styles.chipOn]} accessibilityRole="button">
              <Text style={styles.chipText}>{minutesLabel(m)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        {canSpeak ? (
          <Pressable onPress={() => void listen()} style={({ pressed }) => [styles.micWrap, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={t('order.sayIt')}>
            <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mic, listening && styles.micOn]}>
              <MicIcon size={26} />
            </LinearGradient>
          </Pressable>
        ) : null}
        <Text style={styles.hint}>{listening ? t('order.listening') : canSpeak ? t('order.sayIt') : ' '}</Text>
        <Pressable onPress={() => answer(null)} style={styles.skip} accessibilityRole="button">
          <Text style={styles.skipText}>{t('order.dontKnow')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  count: { position: 'absolute', top: 16, fontFamily: fonts.medium, fontSize: 13, color: colors.faint },
  mascot: { height: 160, alignItems: 'center', justifyContent: 'center' },
  bubble: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24, backgroundColor: colors.card, maxWidth: 340 },
  question: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.ink, textAlign: 'center' },
  heard: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.line },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  footer: { alignItems: 'center', gap: 8, paddingBottom: 10 },
  micWrap: { borderRadius: 32, overflow: 'hidden' },
  mic: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  micOn: { opacity: 0.8 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  skipText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});
