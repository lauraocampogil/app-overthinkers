import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CameraIcon } from '@/components/Iconos';
import { CloseIcon, IconCircle, PrimaryButton, Screen, TextButton } from '@/components/ui';
import { t } from '@/i18n';
import { verifyProof } from '@/lib/ai';
import { endFocus } from '@/lib/foco';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Proof: the task stays open (and its reminder keeps coming back) until a photo shows it is done.
 * The AI checks the photo matches the task; the photo itself stays on the phone.
 */
type Phase = { kind: 'ask' } | { kind: 'checking'; uri: string } | { kind: 'no'; uri: string; reason: string } | { kind: 'yes'; uri: string };

export default function Prueba() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const task = useDay((s) => s.tasks.find((x) => x.id === id));
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' });
  const [denied, setDenied] = useState(false);

  if (!task) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconCircle label={t('common.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconCircle>
        </View>
        <View style={styles.body}>
          <Text style={type.title}>{t('proof.gone')}</Text>
        </View>
      </Screen>
    );
  }

  const pick = async (camera: boolean) => {
    setDenied(false);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setDenied(true);
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.uri) return;
    setPhase({ kind: 'checking', uri: asset.uri });
    try {
      const ctx = ImageManipulator.manipulate(asset.uri);
      if ((asset.width ?? 0) > 1080) ctx.resize({ width: 1080 });
      const image = await ctx.renderAsync();
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      const check = await verifyProof(out.base64 ?? '', task.title, task.proof);
      if (!check.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setPhase({ kind: 'no', uri: out.uri, reason: check.failed ? t('proof.failed') : check.reason || t('proof.noDefault') });
        return;
      }
      // Keep the photo with the task (documents folder survives cache clean-ups).
      let kept = out.uri;
      try {
        const dest = new File(Paths.document, `proof-${task.id}.jpg`);
        if (dest.exists) dest.delete();
        new File(out.uri).copy(dest);
        kept = dest.uri;
      } catch (e) {
        console.warn('[proof] keep photo', e);
      }
      if (from === 'foco') endFocus();
      useDay.getState().proveDone(task.id, kept, Boolean(check.offline));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhase({ kind: 'yes', uri: kept });
    } catch (e) {
      console.warn('[proof]', e);
      setPhase({ kind: 'no', uri: asset.uri, reason: t('proof.failed') });
    }
  };

  const shown = phase.kind === 'ask' ? null : phase.uri;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
      </View>
      <View style={styles.body}>
        <Text style={type.label}>{t('proof.label').toUpperCase()}</Text>
        <Text style={type.title} accessibilityRole="header">
          {phase.kind === 'yes' ? t('proof.yesTitle') : task.title}
        </Text>
        <Text style={type.muted}>
          {phase.kind === 'yes'
            ? t('proof.yesBody')
            : phase.kind === 'checking'
              ? t('proof.checking')
              : t('proof.ask', { proof: task.proof ?? t('proof.anyPhoto') })}
        </Text>

        <View style={styles.frame}>
          {shown ? (
            <Image source={{ uri: shown }} style={styles.photo} accessibilityIgnoresInvertColors />
          ) : (
            <Pressable onPress={() => void pick(true)} style={styles.empty} accessibilityRole="button" accessibilityLabel={t('proof.take')}>
              <CameraIcon size={44} color={colors.muted} strokeWidth={1.5} />
              <Text style={styles.emptyText}>{task.proof ?? t('proof.anyPhoto')}</Text>
            </Pressable>
          )}
          {phase.kind === 'checking' ? (
            <View style={styles.overlay}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.overlayText}>{t('proof.checking')}</Text>
            </View>
          ) : null}
          {phase.kind === 'yes' ? (
            <View style={[styles.overlay, { backgroundColor: 'rgba(10,10,10,0.35)' }]}>
              <Text style={styles.big}>✓</Text>
            </View>
          ) : null}
        </View>

        {phase.kind === 'no' ? (
          <View style={styles.reason} accessibilityLiveRegion="polite">
            <Text style={styles.reasonTitle}>{t('proof.noTitle')}</Text>
            <Text style={type.muted}>{phase.reason}</Text>
          </View>
        ) : null}
        {denied ? <Text style={[type.muted, { color: colors.danger }]}>{t('proof.cameraDenied')}</Text> : null}
      </View>

      <View style={styles.footer}>
        {phase.kind === 'yes' ? (
          <PrimaryButton label={t('proof.back')} onPress={() => router.replace('/')} />
        ) : (
          <>
            <PrimaryButton
              label={phase.kind === 'no' ? t('proof.retry') : t('proof.take')}
              onPress={() => void pick(true)}
              disabled={phase.kind === 'checking'}
            />
            <TextButton label={t('proof.library')} onPress={() => void pick(false)} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { flex: 1, paddingHorizontal: 24, gap: 12, marginTop: 8 },
  frame: { flex: 1, maxHeight: 380, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.card, marginTop: 8 },
  photo: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, borderRadius: 28 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(10,10,10,0.55)' },
  overlayText: { fontFamily: fonts.medium, fontSize: 15, color: colors.white },
  big: { fontFamily: fonts.bold, fontSize: 64, color: colors.white },
  reason: { backgroundColor: colors.card, borderRadius: 20, padding: 16, gap: 4 },
  reasonTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  footer: { paddingHorizontal: 24, paddingBottom: 6, gap: 4 },
});
