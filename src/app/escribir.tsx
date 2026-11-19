import * as Clipboard from 'expo-clipboard';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { CloseIcon, IconCircle, PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { tasksFromImage } from '@/lib/ai';
import { canUse } from '@/lib/limite';
import { CameraIcon } from '@/components/Iconos';
import { supabase } from '@/lib/supabase';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const PasteIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Rect x={8} y={3} width={8} height={4} rx={1} stroke={colors.ink} strokeWidth={1.8} />
    <Path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" stroke={colors.ink} strokeWidth={1.8} />
  </Svg>
);
const ImageIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={18} height={18} rx={3} stroke={colors.ink} strokeWidth={1.8} />
    <Path d="M3 16l5-5 4 4 3-3 6 6" stroke={colors.ink} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const join = (current: string, extra: string) => (current.trim() ? `${current.trim()}, ${extra}` : extra);

export default function Escribir() {
  const setDraft = useDay((s) => s.setDraft);
  const { meta, snap } = useLocalSearchParams<{ meta?: string; snap?: string }>();
  const goalMode = meta === '1';
  // Always start empty: the previous dump was already turned into tasks.
  const [text, setText] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const go = () => {
    Keyboard.dismiss();
    setDraft(text.trim());
    router.replace('/ordenando');
  };

  const paste = async () => {
    setNotice(null);
    const copied = (await Clipboard.getStringAsync()).trim();
    if (!copied) {
      setNotice(t('write.nothingToPaste'));
      return;
    }
    setText((cur) => join(cur, copied));
  };

  // Long-press on "+" opens the camera straight away (Snap).
  const snapped = useRef(false);
  useEffect(() => {
    if (snap === '1' && !snapped.current) {
      snapped.current = true;
      void fromScreenshot('camera');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

  /** Snap: a photo of a notebook, whiteboard, receipt, fridge list or letter, or a screenshot → tasks. */
  const fromScreenshot = async (source: 'library' | 'camera' = 'library') => {
    setNotice(null);
    // A photo or screenshot turned into tasks is Pro (product plan).
    if (!(await canUse('photo'))) {
      router.push({ pathname: '/pro', params: { reason: 'photo' } });
      return;
    }
    Keyboard.dismiss();
    if (!supabase) {
      setNotice(t('write.needServer'));
      return;
    }
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setNotice(t('write.cameraDenied'));
        return;
      }
    }
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset?.uri) return;
    setReading(true);
    let tasks = null;
    try {
      // Full-size PNG screenshots (or HEIC photos) are too big / not accepted by the AI:
      // send a 1080 px wide JPEG instead, which keeps message text readable.
      const ctx = ImageManipulator.manipulate(asset.uri);
      if ((asset.width ?? 0) > 1080) ctx.resize({ width: 1080 });
      const image = await ctx.renderAsync();
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
      if (out.base64) tasks = await tasksFromImage(out.base64, 'image/jpeg');
    } catch (e) {
      console.warn('[write] screenshot', e);
    }
    setReading(false);
    if (!tasks || !tasks.length) {
      setNotice(t('write.importFailed'));
      return;
    }
    // Keep what the screenshot says (time, place, items) so it ends up inside each task.
    const lines = tasks.map((x) =>
      [x.title, x.at ? `${t('write.at')} ${x.at}` : '', x.where ? `${t('write.in')} ${x.where}` : '', x.checklist?.length ? `(${x.checklist.join(', ')})` : '']
        .filter(Boolean)
        .join(' '),
    );
    setText((cur) => join(cur, lines.join('. ')));
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <IconCircle label={t('common.close')} onPress={() => router.back()}>
                <CloseIcon />
              </IconCircle>
              {keyboard && (
                <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.doneBtn} hitSlop={8}>
                  <Text style={styles.doneText}>{t('write.done')}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.body}>
              {!keyboard && (
                <>
                  <Text style={type.title} accessibilityRole="header">{t(goalMode ? 'write.goalTitle' : 'write.title')}</Text>
                  <Text style={type.muted}>{t(goalMode ? 'write.goalHint' : 'write.hint')}</Text>
                </>
              )}

              <View style={styles.chips}>
                <Pressable accessibilityRole="button" onPress={paste} style={styles.chip}>
                  <PasteIcon />
                  <Text style={styles.chipText}>{t('write.paste')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void fromScreenshot('camera')} style={styles.chip} disabled={reading}>
                  {reading ? <ActivityIndicator size="small" color={colors.accent} /> : <CameraIcon size={18} color={colors.ink} />}
                  <Text style={styles.chipText}>{t(reading ? 'write.reading' : 'write.snap')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void fromScreenshot('library')} style={styles.chip} disabled={reading}>
                  <ImageIcon />
                  <Text style={styles.chipText}>{t('write.screenshot')}</Text>
                </Pressable>
              </View>
              {notice && <Text style={styles.notice}>{notice}</Text>}

              <TextInput
                accessibilityLabel={t('write.inputLabel')}
                value={text}
                onChangeText={setText}
                multiline
                placeholder={t(goalMode ? 'write.goalPlaceholder' : 'write.placeholder')}
                placeholderTextColor={colors.faint}
                style={styles.input}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.footer}>
              <PrimaryButton label={t('write.cta')} onPress={go} disabled={text.trim().length < 3 || reading} />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 8, height: 44 },
  doneBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.card, justifyContent: 'center' },
  doneText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
  body: { flex: 1, paddingHorizontal: 24, marginTop: 20, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  notice: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  input: {
    flex: 1,
    minHeight: 120,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.card,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
  },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
