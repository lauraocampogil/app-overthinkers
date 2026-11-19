import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { MascotaMarca } from '@/components/Logo';
import { Mascota } from '@/components/Mascota';
import { MicIcon, Screen } from '@/components/ui';
import { lang, locale, minutesLabel, t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { parseDuration } from '@/lib/tiempo';
import type { TaskQuestion } from '@/lib/types';
import { cleanFillers, liveSpeechAvailable, pickLocale, requestLivePermission, startLive, type LiveSession } from '@/lib/voz';
import { colors, fonts } from '@/theme';

const MINUTES = [15, 30, 45, 60, 90];
/** Deadlines as days from today. */
const DEADLINES: { label: string; days: number }[] = [
  { label: 'ask.thisWeek', days: 7 },
  { label: 'ask.twoWeeks', days: 14 },
  { label: 'ask.thisMonth', days: 30 },
  { label: 'ask.threeMonths', days: 90 },
];

export type Answer = { minutes?: number; text?: string; dueInDays?: number } | null;

/**
 * Right after GetGo understood what the person said, it asks what's missing, one question at a time, with the
 * mascot: "¿Qué libro?", "¿Cuánto tiempo?", "¿Para cuándo?". Tap an answer, type it, or say it.
 */
export function PreguntaTiempo({ questions, onDone }: { questions: (TaskQuestion & { task: string })[]; onDone: (answers: Answer[]) => void }) {
  const mascot = useMascot();
  const voz = useVoz();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => null));
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const session = useRef<LiveSession | null>(null);
  const canSpeak = liveSpeechAvailable();
  const cur = questions[i];
  // A place ("¿Dónde es pilates?") is answered like any text.
  const isText = cur?.kind === 'text' || cur?.kind === 'place';

  const answer = (a: Answer) => {
    session.current?.cancel();
    session.current = null;
    setListening(false);
    setHeard('');
    setTyped('');
    void Haptics.selectionAsync().catch(() => {});
    const next = answers.map((x, k) => (k === i ? a : x));
    setAnswers(next);
    if (i + 1 >= questions.length) onDone(next);
    else setI(i + 1);
  };

  const listen = async () => {
    if (listening) {
      session.current?.cancel();
      session.current = null;
      setListening(false);
      // A spoken text answer is taken when the person taps again.
      if (isText && heard.trim()) answer({ text: cleanFillers(heard).trim() });
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
        if (cur.kind === 'minutes') {
          const m = parseDuration(text);
          if (m) {
            taken = true;
            setTimeout(() => session.current === mine && answer({ minutes: m }), 450);
          }
        }
      },
      onLevel: () => {},
      onError: () => setListening(false),
    });
    session.current = mine;
  };

  useEffect(() => () => session.current?.cancel(), []);
  if (!cur) return null;
  const speakable = canSpeak && cur.kind !== 'deadline' && cur.kind !== 'choice';

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrap}>
          <Text style={styles.count} numberOfLines={1}>
            {i + 1}/{questions.length} · {cur.task}
          </Text>
          <View style={styles.mascot}>
            {mascot.unlocked ? <Mascota seed={mascot.seed} size={140} mood={listening ? 'escucha' : 'calma'} /> : <MascotaMarca size={140} />}
          </View>
          <Animated.View key={i} entering={FadeInDown.duration(320)} style={styles.bubble}>
            <Text style={styles.question} accessibilityRole="header">
              {cur.q}
            </Text>
          </Animated.View>
          {heard ? (
            <Animated.Text entering={FadeIn} style={styles.heard}>
              “{heard}”
            </Animated.Text>
          ) : null}

          {cur.kind === 'minutes' ? (
            <View style={styles.chips}>
              {MINUTES.map((m) => (
                <Pressable key={m} onPress={() => answer({ minutes: m })} style={({ pressed }) => [styles.chip, pressed && styles.chipOn]} accessibilityRole="button">
                  <Text style={styles.chipText}>{minutesLabel(m)}</Text>
                </Pressable>
              ))}
            </View>
          ) : cur.kind === 'choice' ? (
            <View style={[styles.chips, { flexDirection: 'column', alignItems: 'stretch' }]}>
              {(cur.options ?? []).map((o) => (
                <Pressable key={o} onPress={() => answer({ text: o })} style={({ pressed }) => [styles.chip, pressed && styles.chipOn]} accessibilityRole="button">
                  <Text style={[styles.chipText, { textAlign: 'center' }]}>{o}</Text>
                </Pressable>
              ))}
            </View>
          ) : cur.kind === 'deadline' ? (
            <View style={styles.chips}>
              {DEADLINES.map((d) => (
                <Pressable key={d.label} onPress={() => answer({ dueInDays: d.days })} style={({ pressed }) => [styles.chip, pressed && styles.chipOn]} accessibilityRole="button">
                  <Text style={styles.chipText}>{t(d.label)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder={cur.kind === 'place' ? t('ask.placeHere') : t('ask.typeHere')}
              placeholderTextColor={colors.faint}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => typed.trim() && answer({ text: typed.trim() })}
            />
          )}
        </View>
        <View style={styles.footer}>
          {speakable ? (
            <Pressable onPress={() => void listen()} style={({ pressed }) => [styles.micWrap, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={t('ask.orSay')}>
              <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mic, listening && { opacity: 0.8 }]}>
                <MicIcon size={26} />
              </LinearGradient>
            </Pressable>
          ) : null}
          <Text style={styles.hint}>{listening ? (isText ? t('ask.tapWhenDone') : t('order.listening')) : speakable ? t('ask.orSay') : ' '}</Text>
          {isText && typed.trim() ? (
            <Pressable onPress={() => answer({ text: typed.trim() })} style={styles.skip} accessibilityRole="button">
              <Text style={[styles.skipText, { color: colors.ink }]}>{t('order.howLongDone')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => answer(null)} style={styles.skip} accessibilityRole="button">
              <Text style={styles.skipText}>{t('order.dontKnow')}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  count: { position: 'absolute', top: 16, left: 24, right: 24, textAlign: 'center', fontFamily: fonts.medium, fontSize: 13, color: colors.faint },
  mascot: { height: 150, alignItems: 'center', justifyContent: 'center' },
  bubble: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24, backgroundColor: colors.card, maxWidth: 340 },
  question: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.ink, textAlign: 'center' },
  heard: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.line },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  input: { alignSelf: 'stretch', minHeight: 52, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.card, fontFamily: fonts.medium, fontSize: 17, color: colors.ink, textAlign: 'center' },
  footer: { alignItems: 'center', gap: 8, paddingBottom: 10 },
  micWrap: { borderRadius: 32, overflow: 'hidden' },
  mic: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  skipText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});
