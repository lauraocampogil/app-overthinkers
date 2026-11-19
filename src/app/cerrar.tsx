import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CameraIcon } from '@/components/Iconos';
import { Mascota } from '@/components/Mascota';
import { CheckIcon, CloseIcon, IconCircle, MicIcon, PrimaryButton, Screen, TextButton } from '@/components/ui';
import { lang, locale, t } from '@/i18n';
import { parseBrainDump } from '@/lib/ai';
import { addEntry } from '@/lib/diario';
import { track } from '@/lib/eventos';
import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { addDays } from '@/lib/planner';
import { topThree } from '@/lib/prioridad';
import { cleanFillers, liveSpeechAvailable, pickLocale, requestLivePermission, startLive, type LiveSession } from '@/lib/voz';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Close the day: see what got done (with its proof), send what is left to tomorrow,
 * empty the head for tomorrow and go to sleep knowing tomorrow's top 3.
 * One screen, one button. With at least one thing done, the day counts for the streak.
 */
export default function Cerrar() {
  const mascot = useMascot();
  const voz = useVoz();
  const day = todayIso();
  const tomorrow = addDays(day, 1);
  const tasks = useDay((s) => s.tasks);
  const areas = useDay((s) => s.profile.areas);
  const closedOn = useDay((s) => s.closedOn);
  const streak = useDay((s) => s.streak.current);

  const done = tasks.filter((x) => x.status === 'hecha' && x.doneOn === day);
  const left = tasks.filter((x) => x.status === 'pendiente' && x.day <= day);
  const tomorrowTop = topThree(
    tasks.filter((x) => x.status === 'pendiente' && (x.day === tomorrow || x.day <= day)),
    tomorrow,
    areas,
  );

  const [moveLeft, setMoveLeft] = useState(true);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addedN, setAddedN] = useState(0);
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const session = useRef<LiveSession | null>(null);
  const canSpeak = liveSpeechAvailable();
  const closed = closedOn === day;

  const stopListening = () => {
    session.current?.cancel();
    session.current = null;
    setListening(false);
  };
  const listen = async () => {
    if (listening) return stopListening();
    if (!(await requestLivePermission())) return;
    const speechLocale = await pickLocale(locale, lang);
    const before = text ? `${text} ` : '';
    setListening(true);
    const mine = startLive(speechLocale, {
      onText: (heard) => session.current === mine && setText(before + cleanFillers(heard)),
      onLevel: () => {},
      onError: () => setListening(false),
    });
    session.current = mine;
  };
  useEffect(() => () => session.current?.cancel(), []);

  const addForTomorrow = async () => {
    const value = text.trim();
    if (!value || adding) return;
    // Okio as a journal: the whole text is kept (on the phone); what is to do becomes tomorrow's plan.
    addEntry(day, value);
    stopListening();
    setAdding(true);
    const res = await parseBrainDump(value);
    setAdding(false);
    const forTomorrow = res.tasks.map((x) => ({ ...x, dueInDays: Math.max(1, x.dueInDays ?? 1) }));
    setText('');
    setSaved(true);
    if (!forTomorrow.length && !res.goals?.length) return;
    track('dump', { source: 'close', n: forTomorrow.length });
    const out = useDay.getState().addParsed({ tasks: forTomorrow, goals: res.goals ?? [] }, { pinDays: true });
    setAddedN((n) => n + out.added);
    setText('');
  };

  const close = () => {
    stopListening();
    useDay.getState().closeDay({ moveLeft });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (closed) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconCircle label={t('common.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconCircle>
        </View>
        <Animated.View entering={FadeIn.duration(400)} style={styles.closed}>
          <Mascota seed={mascot.seed} size={180} mood="feliz" />
          <Text style={[type.title, { textAlign: 'center' }]}>{t('close.doneTitle')}</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            {done.length ? t('close.doneBody', { n: streak }) : t('close.restBody')}
          </Text>
          {tomorrowTop.length ? (
            <View style={styles.topList}>
              <Text style={styles.section}>{t('close.tomorrowTop')}</Text>
              {tomorrowTop.map((x, i) => (
                <Text key={x.id} style={styles.topItem} numberOfLines={1}>
                  {i + 1}. {x.title}
                </Text>
              ))}
            </View>
          ) : null}
        </Animated.View>
        <View style={styles.footer}>
          <PrimaryButton label={t('close.goodnight')} onPress={() => router.back()} dark />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={type.title} accessibilityRole="header">
            {t('close.title')}
          </Text>
          <Text style={type.muted}>{t('close.body')}</Text>

          <Text style={styles.section}>{t('close.done', { n: done.length })}</Text>
          {done.length ? (
            <View style={styles.card}>
              {done.map((x) => (
                <View key={x.id} style={styles.row}>
                  {x.proofPhoto ? (
                    <Image source={{ uri: x.proofPhoto }} style={styles.thumb} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={styles.check}>
                      <CheckIcon color={colors.white} size={12} />
                    </View>
                  )}
                  <Text style={styles.rowText} numberOfLines={1}>
                    {x.title}
                  </Text>
                  {!x.proofPhoto && x.top ? (
                    <Pressable
                      onPress={() => router.push({ pathname: '/prueba', params: { id: x.id, from: 'cerrar' } })}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('close.prove')}
                    >
                      <CameraIcon size={18} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={type.muted}>{t('close.noneDone')}</Text>
          )}

          {left.length ? (
            <>
              <Text style={styles.section}>{t('close.left', { n: left.length })}</Text>
              <View style={styles.card}>
                {left.slice(0, 8).map((x) => (
                  <View key={x.id} style={styles.row}>
                    <View style={styles.dot} />
                    <Text style={[styles.rowText, { color: colors.muted }]} numberOfLines={1}>
                      {x.title}
                    </Text>
                  </View>
                ))}
                {left.length > 8 ? <Text style={styles.more}>+{left.length - 8}</Text> : null}
              </View>
              <Pressable onPress={() => setMoveLeft((v) => !v)} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: moveLeft }}>
                <View style={[styles.box, moveLeft && styles.boxOn]}>{moveLeft ? <CheckIcon color={colors.white} size={12} /> : null}</View>
                <Text style={styles.toggleText}>{t('close.moveLeft')}</Text>
              </Pressable>
            </>
          ) : null}

          <Text style={styles.section}>{t('close.headTitle')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('close.headPlaceholder')}
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
              accessibilityLabel={t('close.headTitle')}
            />
            <View style={styles.inputActions}>
              {canSpeak ? (
                <Pressable onPress={() => void listen()} accessibilityRole="button" accessibilityLabel={t('listen.listening')}>
                  <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mic, listening && { transform: [{ scale: 1.08 }] }]}>
                    <MicIcon size={18} />
                  </LinearGradient>
                </Pressable>
              ) : null}
              {adding ? (
                <ActivityIndicator color={colors.ink} />
              ) : text.trim() ? (
                <TextButton label={t('close.add')} onPress={() => void addForTomorrow()} color={colors.ink} />
              ) : null}
            </View>
          </View>
          {saved ? <Text style={type.muted}>{[t('close.saved'), addedN ? t('close.added', { n: addedN }) : ''].filter(Boolean).join(' ')}</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('close.cta')} onPress={close} dark />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12 },
  section: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 10 },
  card: { borderRadius: 22, backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  thumb: { width: 30, height: 30, borderRadius: 9 },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.faint, marginHorizontal: 11 },
  more: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, paddingBottom: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, flex: 1 },
  inputWrap: { borderRadius: 22, backgroundColor: colors.card, padding: 14, gap: 10 },
  input: { minHeight: 64, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  inputActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mic: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  topList: { alignSelf: 'stretch', gap: 6, marginTop: 8, borderRadius: 22, backgroundColor: colors.card, padding: 16 },
  topItem: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});
