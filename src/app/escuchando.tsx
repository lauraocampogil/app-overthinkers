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
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Degradado } from '@/components/Degradado';
import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { transcribe } from '@/lib/ai';
import { useMascot } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

type Phase = 'starting' | 'recording' | 'transcribing' | 'denied' | 'failed' | 'noServer';

const RECORDING = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

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
  // Without a server there is no real transcription: say so instead of inventing text.
  const [phase, setPhase] = useState<Phase>(supabase ? 'starting' : 'noServer');
  const started = useRef(false);
  const stopping = useRef(false);

  useEffect(() => {
    if (!supabase || started.current) return; // guard against the effect running twice
    started.current = true;
    let cancelled = false;

    (async () => {
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
      if (recorder.isRecording) void recorder.stop().catch(() => {});
      void disableRecordingSession();
    };
  }, [recorder]);

  // Metering is in dBFS (about -60 silence .. 0 loud) -> 0..1 for the waves.
  const level = state.metering === undefined ? 0 : Math.min(1, Math.max(0, (state.metering + 55) / 50));

  const finish = async () => {
    if (stopping.current) return;
    stopping.current = true;
    setPhase('transcribing');
    try {
      await recorder.stop();
      await disableRecordingSession();
      const uri = recorder.uri;
      const text = uri ? await transcribe(uri) : null;
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
        </View>
        <PrimaryButton label={t('listen.writeInstead')} onPress={() => router.replace('/escribir')} />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>{t('common.back')}</Text>
        </Pressable>
      </Screen>
    );
  }

  const live = phase === 'recording' ? level : 0.15;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Degradado level={live} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.timer} accessibilityLabel={t('listen.recording', { time: mmss(state.durationMillis) })}>
          <View style={styles.dot} />
          <Text style={styles.timerText}>{mmss(state.durationMillis)}</Text>
        </View>

        <View style={styles.center}>
          {mascot.unlocked ? (
            <Mascota seed={mascot.seed} size={220} mood="escucha" level={live} />
          ) : (
            <Ondas mode="habla" height={220} level={live} fadeTo="transparent" />
          )}
          <Text style={styles.prompt} accessibilityLiveRegion="polite">
            {t(phase === 'transcribing' ? 'listen.wait' : 'listen.prompt')}
          </Text>
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
              <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
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
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  timerText: { fontFamily: fonts.medium, fontSize: 15, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  center: { flex: 1, justifyContent: 'center', gap: 28 },
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
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  done: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
});
