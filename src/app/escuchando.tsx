import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Degradado } from '@/components/Degradado';
import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { PrimaryButton, Screen } from '@/components/ui';
import { lang, locale, t } from '@/i18n';
import { lastVoiceError, transcribe } from '@/lib/ai';
import { useMascot } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cleanFillers, liveSpeechAvailable, pickLocale, requestLivePermission, startLive, type LiveSession } from '@/lib/voz';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

type Phase = 'starting' | 'recording' | 'transcribing' | 'denied' | 'failed' | 'noServer';

const RECORDING = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** iOS needs a play-and-record session that does not mix with other apps before preparing. */
async function enableRecordingSession() {
  await setIsAudioActiveAsync(true);
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix' });
}

async function disableRecordingSession() {
  try {
    await setAudioModeAsync({ allowsRecording: false, interruptionMode: 'mixWithOthers' });
  } catch {
    // Not critical: the next recording sets the mode again.
  }
}

export default function Escuchando() {
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 100);
  const setDraft = useDay((s) => s.setDraft);
  const mascot = useMascot();
  // Live mode: the phone's recogniser writes the words while you talk (development / store build).
  // Fallback (Expo Go): record, then transcribe on the server. Without either, say so instead of inventing text.
  const [live] = useState(() => liveSpeechAvailable());
  const [phase, setPhase] = useState<Phase>(live || supabase ? 'starting' : 'noServer');
  const [heard, setHeard] = useState('');
  const [errCode, setErrCode] = useState('');
  const [liveLevel, setLiveLevel] = useState(0);
  const session = useRef<LiveSession | null>(null);
  const started = useRef(false);
  const stopping = useRef(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (started.current || (!live && !supabase)) return; // guard against the effect running twice
    started.current = true;
    let cancelled = false;

    (async () => {
      if (live) {
        if (!(await requestLivePermission())) {
          if (!cancelled) setPhase('denied');
          return;
        }
        const speechLocale = await pickLocale(locale, lang);
        if (cancelled) return;
        session.current = startLive(speechLocale, {
          onText: (v) => setHeard(cleanFillers(v)),
          onLevel: setLiveLevel,
          onError: (code) => {
            console.warn('[voz]', code);
            setErrCode(`voz: ${code}`);
            if (!stopping.current) setPhase('failed');
          },
        });
        setPhase('recording');
        return;
      }
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        if (!cancelled) setPhase('denied');
        return;
      }
      await enableRecordingSession();
      try {
        await recorder.prepareToRecordAsync(RECORDING);
      } catch (first) {
        // The session sometimes needs a moment to activate (e.g. right after other audio). Retry once.
        console.warn('[record] first prepare failed, retrying', first);
        await wait(400);
        await enableRecordingSession();
        await recorder.prepareToRecordAsync(RECORDING);
      }
      if (cancelled) return;
      recorder.record();
      setPhase('recording');
    })().catch((e) => {
      console.warn('[record]', e);
      if (!cancelled) setPhase('failed');
    });

    return () => {
      cancelled = true;
      session.current?.cancel();
      if (recorder.isRecording) void recorder.stop().catch(() => {});
      if (!live) void disableRecordingSession();
    };
  }, [recorder, live]);

  // Metering is in dBFS (about -60 silence .. 0 loud) -> 0..1 for the animation.
  const meter = state.metering === undefined ? 0 : Math.min(1, Math.max(0, (state.metering + 55) / 50));
  const level = live ? liveLevel : meter;

  const finish = async () => {
    if (stopping.current) return;
    stopping.current = true;
    setPhase('transcribing');
    try {
      let text: string | null;
      if (live && session.current) {
        const out = await session.current.finish();
        session.current = null;
        text = out.text || null;
        // Second, more accurate pass with Whisper on the server (like a proper dictation); the live text is the fallback.
        if (out.uri && supabase) {
          const precise = await transcribe(out.uri);
          if (precise && precise.trim().length >= Math.min(8, (text ?? '').length / 2)) text = cleanFillers(precise);
        }
      } else {
        await recorder.stop();
        await disableRecordingSession();
        const uri = recorder.uri;
        text = uri ? await transcribe(uri) : null;
        if (text) text = cleanFillers(text);
        if (text) setHeard(text);
      }
      if (!text) {
        setPhase('failed');
        stopping.current = false;
        return;
      }
      setDraft(text);
      router.replace('/ordenando');
    } catch (e) {
      console.warn('[record] stop failed', e);
      setPhase('failed');
      stopping.current = false;
    }
  };

  const cancel = () => {
    session.current?.cancel();
    session.current = null;
    if (recorder.isRecording) void recorder.stop().catch(() => {});
    router.back();
  };

  if (phase === 'denied' || phase === 'failed' || phase === 'noServer') {
    const title = phase === 'denied' ? 'listen.deniedTitle' : phase === 'noServer' ? 'listen.noServerTitle' : 'listen.failedTitle';
    const body = phase === 'denied' ? 'listen.deniedBody' : phase === 'noServer' ? 'listen.noServerBody' : 'listen.failedBody';
    return (
      <Screen style={styles.pad}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
          <Text style={type.title}>{t(title)}</Text>
          <Text style={type.muted}>{t(body)}</Text>
          {phase === 'failed' && (errCode || lastVoiceError) ? <Text style={styles.code}>{errCode || lastVoiceError}</Text> : null}
        </View>
        <PrimaryButton label={t('listen.writeInstead')} onPress={() => router.replace('/escribir')} />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>{t('common.back')}</Text>
        </Pressable>
      </Screen>
    );
  }

  const shown = phase === 'recording' ? level : 0.15;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Degradado level={shown} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.center}>
          {mascot.unlocked ? (
            <Mascota seed={mascot.seed} size={220} mood="escucha" level={shown} />
          ) : (
            <Ondas mode="habla" height={220} level={shown} fadeTo="transparent" />
          )}
          {heard ? (
            <ScrollView
              ref={scroller}
              style={styles.heardBox}
              contentContainerStyle={styles.heardContent}
              onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.heard} accessibilityLiveRegion="polite">
                {heard}
              </Text>
            </ScrollView>
          ) : (
            <Text style={styles.prompt}>
              {t(phase === 'transcribing' ? 'listen.wait' : live ? 'listen.prompt' : 'listen.promptLater')}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={cancel} hitSlop={8}>
            <BlurView intensity={30} tint="light" style={styles.cancel}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M6 6l12 12M18 6L6 18" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </BlurView>
          </Pressable>
          <Text style={styles.hint}>{t(phase === 'recording' ? 'listen.tapToFinish' : 'listen.transcribing')}</Text>
          {phase === 'recording' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('listen.finish')} onPress={finish} style={styles.done} hitSlop={8}>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.accentDark} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ) : (
            <View style={styles.done}>
              <ActivityIndicator color={colors.accentDark} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingBottom: 12 },
  center: { flex: 1, justifyContent: 'center', gap: 28, paddingTop: 24 },
  heardBox: { maxHeight: 260, flexGrow: 0 },
  heardContent: { paddingHorizontal: 28 },
  heard: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 35, letterSpacing: -0.6, color: '#FFFFFF', textAlign: 'center' },
  prompt: {
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 12 },
  cancel: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  done: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  code: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginTop: 8 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
});
