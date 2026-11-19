import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/Iconos';
import { Mascota } from '@/components/Mascota';
import { CheckIcon, CloseIcon, IconCircle, Screen } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { canUse, countUse } from '@/lib/limite';
import { useDay } from '@/store/day';
import { bondStage, useVinculo } from '@/lib/vinculo';
import { askOkio, clearChat, KEEP_DAYS, pruneChat, useMentor } from '@/lib/mentor';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

const STARTERS = ['mentor.s1', 'mentor.s2', 'mentor.s3', 'mentor.s4'];

/**
 * Talk to Okio: a calm mentor that knows today's plan, the goals and the week's score.
 * Short answers, one small step at a time. Monochrome; only the mascot carries colour.
 */
export default function Mentor() {
  const chat = useMentor((s) => s.chat);
  const mascot = useMascot();
  const bondPoints = useVinculo((s) => s.points);
  const streakNow = useDay((s) => s.streak.current);
  const voz = useVoz();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(pruneChat, []);

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [chat.length, busy]);

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    if (!(await canUse('chat'))) {
      router.push({ pathname: '/pro', params: { reason: 'chat' } });
      return;
    }
    countUse('chat');
    setText('');
    setBusy(true);
    await askOkio(v);
    setBusy(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
        <Text style={styles.headerTitle}>Okio</Text>
        {chat.length ? (
          <Pressable onPress={clearChat} hitSlop={10} accessibilityRole="button">
            <Text style={styles.clear}>{t('mentor.clear')}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            {/* Your Okio lives here now: tap it to see how it is growing (bond, days together, your week). */}
            <Pressable onPress={() => router.push('/progreso')} accessibilityRole="button" accessibilityLabel={t('mentor.yourOkio')}>
              <Mascota seed={mascot.seed} size={chat.length ? 84 : 150} mood={busy ? 'escucha' : 'calma'} />
            </Pressable>
            <Pressable onPress={() => router.push('/progreso')} hitSlop={6} accessibilityRole="button">
              <Text style={styles.together}>{t(`bond.stage${bondStage(bondPoints)}`)} · {t('bond.days', { n: streakNow })}</Text>
            </Pressable>
            {!chat.length ? (
              <>
                <Text style={styles.heroTitle}>{t('mentor.title')}</Text>
                <Text style={styles.heroBody}>{t('mentor.body')}</Text>
              </>
            ) : null}
          </View>
          {!chat.length ? (
            <View style={styles.starters}>
              {STARTERS.map((k) => (
                <Pressable key={k} onPress={() => void send(t(k))} style={styles.starter} accessibilityRole="button">
                  <Text style={styles.starterText}>{t(k)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {chat.length ? <Text style={styles.keep}>{t('mentor.keep', { n: KEEP_DAYS })}</Text> : null}
          {chat.map((m, i) => {
            const day = new Date(m.at).toDateString();
            const newDay = i === 0 || new Date(chat[i - 1].at).toDateString() !== day;
            return (
              <View key={m.at + m.role} style={{ gap: 10 }}>
                {newDay ? (
                  <Text style={styles.dayLabel}>
                    {day === new Date().toDateString() ? t('due.today') : new Date(m.at).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                ) : null}
                <Animated.View entering={FadeInDown.duration(220)} style={[styles.bubble, m.role === 'user' ? styles.me : styles.okio]}>
                  <Text style={[styles.bubbleText, m.role === 'user' && { color: colors.white }]}>{m.content}</Text>
                </Animated.View>
                {m.added?.length ? (
                  <Pressable onPress={() => router.navigate('/')} style={styles.added} accessibilityRole="button" accessibilityLabel={t('mentor.added', { n: m.added.length })}>
                    <Text style={styles.addedTitle}>{t('mentor.added', { n: m.added.length })}</Text>
                    {m.added.slice(0, 6).map((title, j) => (
                      <View key={j} style={styles.addedRow}>
                        <CheckIcon size={14} color={colors.ink} />
                        <Text style={styles.addedText} numberOfLines={1}>{title}</Text>
                      </View>
                    ))}
                    <Text style={styles.addedLink}>{t('mentor.seePlan')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {busy ? (
            <View style={[styles.bubble, styles.okio]}>
              <Text style={[styles.bubbleText, { color: colors.muted }]}>{t('mentor.thinking')}</Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('mentor.placeholder')}
            placeholderTextColor={colors.faint}
            style={styles.input}
            multiline
            onSubmitEditing={() => void send(text)}
            accessibilityLabel={t('mentor.placeholder')}
          />
          <Pressable onPress={() => void send(text)} disabled={!text.trim() || busy} accessibilityRole="button" accessibilityLabel={t('mentor.send')}>
            <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.send, (!text.trim() || busy) && { opacity: 0.4 }]}>
              <ArrowRightIcon color={colors.white} size={18} strokeWidth={2.2} />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 52 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  clear: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, minWidth: 44, textAlign: 'right' },
  body: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  together: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textAlign: 'center' },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.9, color: colors.ink, textAlign: 'center' },
  heroBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center', paddingHorizontal: 12 },
  starters: { gap: 8, marginTop: 6 },
  starter: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.card },
  starterText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  bubble: { maxWidth: '84%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 },
  me: { alignSelf: 'flex-end', backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  okio: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, color: colors.ink },
  dayLabel: { alignSelf: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textTransform: 'capitalize', marginTop: 6 },
  added: { alignSelf: 'flex-start', maxWidth: '84%', gap: 6, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 18, borderWidth: 1, borderColor: colors.line },
  addedTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addedText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, flexShrink: 1 },
  addedLink: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 2 },
  keep: { alignSelf: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    borderRadius: 24,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
