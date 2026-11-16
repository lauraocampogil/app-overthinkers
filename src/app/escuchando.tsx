import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ondas } from '@/components/Ondas';
import { CloseIcon, IconCircle, PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { transcribe } from '@/lib/ai';
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

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.cancel')} onPress={cancel}>
          <CloseIcon />
        </IconCircle>
        <View style={styles.timer} accessibilityLabel={t('listen.recording', { time: mmss(state.durationMillis) })}>
          <View style={styles.dot} />
          <Text style={styles.timerText}>{mmss(state.durationMillis)}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.prompt}>{t(phase === 'transcribing' ? 'listen.wait' : 'listen.prompt')}</Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Ondas mode="habla" height={320} level={phase === 'recording' ? level : 0.2} />
      </View>

      <View style={styles.footer}>
        {phase === 'recording' ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('listen.finish')} onPress={finish} style={styles.stop}>
            <View style={styles.stopSquare} />
          </Pressable>
        ) : (
          <View style={styles.stop}>
            <ActivityIndicator color={colors.white} />
          </View>
        )}
        <Text style={styles.hint}>{t(phase === 'recording' ? 'listen.tapToFinish' : 'listen.transcribing')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 44, marginTop: 8 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  timerText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  prompt: { fontFamily: fonts.regular, fontSize: 24, lineHeight: 31, letterSpacing: -0.5, color: colors.ink, paddingHorizontal: 24, marginTop: 32 },
  footer: { alignItems: 'center', gap: 12, paddingBottom: 16 },
  stop: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.white },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
});
