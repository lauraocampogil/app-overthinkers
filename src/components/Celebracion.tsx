import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';

import { Mascota } from '@/components/Mascota';
import { t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

const PIECES = 18;

/** One piece of confetti: flies out from the mascot and falls a little, then fades. */
function Piece({ i, burst, color }: { i: number; burst: SharedValue<number>; color: string }) {
  const angle = (i / PIECES) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const dist = 120 + (i % 4) * 28;
  const size = 8 + (i % 3) * 4;
  const style = useAnimatedStyle(() => {
    const p = burst.value;
    return {
      opacity: p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [
        { translateX: Math.cos(angle) * dist * p },
        { translateY: Math.sin(angle) * dist * p + p * p * 60 },
        { rotate: `${p * (i % 2 ? 260 : -220)}deg` },
        { scale: 0.4 + p * 0.8 },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: size, height: i % 3 === 0 ? size : size * 0.45, borderRadius: i % 3 === 0 ? size / 2 : 2, backgroundColor: color }, style]} />;
}

/** Where each colour cloud starts (spread over the screen like the listening gradient) before gathering. */
const CLOUDS = [
  { x: -0.55, y: -0.7 },
  { x: 0.6, y: -0.6 },
  { x: 0.7, y: 0.45 },
  { x: -0.6, y: 0.55 },
  { x: 0.05, y: 0.95 },
];

/** A soft colour cloud of the voice gradient: starts big and far, gathers behind the mascot. */
function Cloud({ i, gather, color, w, h }: { i: number; gather: SharedValue<number>; color: string; w: number; h: number }) {
  const c = CLOUDS[i];
  const size = 340;
  const style = useAnimatedStyle(() => {
    const g = gather.value;
    return {
      transform: [
        { translateX: c.x * w * (1 - g) + Math.cos(i * 1.3) * 26 * g },
        { translateY: c.y * h * (1 - g) + Math.sin(i * 1.3) * 26 * g },
        { scale: 2.4 - 1.75 * g },
      ],
      opacity: 0.95 - 0.25 * g,
    };
  });
  return (
    <Animated.View style={[styles.cloud, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`cl${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.9" />
            <Stop offset="0.4" stopColor={color} stopOpacity="0.55" />
            <Stop offset="0.75" stopColor={color} stopOpacity="0.15" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#cl${i})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Shown once, when the last task of the day is ticked: the mascot (or the voice gradient while it is
 * still hidden) pops in, confetti in its colours, and a short message that the list is done.
 */
export function Celebracion({ visible, done, streak, onClose }: { visible: boolean; done: number; streak: number; onClose: () => void }) {
  const mascot = useMascot();
  const voz = useVoz();
  const { width: w, height: h } = useWindowDimensions();
  const burst = useSharedValue(0);
  const gather = useSharedValue(0);
  const wash = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    burst.value = 0;
    burst.value = withDelay(1100, withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) }));
    // The whole screen starts in the voice gradient; its clouds gather behind the mascot and the white comes back.
    gather.value = 0;
    gather.value = withDelay(250, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }));
    wash.value = 1;
    wash.value = withDelay(350, withTiming(0, { duration: 1100, easing: Easing.out(Easing.quad) }));
  }, [visible, burst, gather, wash]);

  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));
  const palette = [voz.mic[0], voz.mic[1], voz.mic[2], colors.ink, '#BDBDBD'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(250)} style={styles.back}>
        <Animated.View style={[StyleSheet.absoluteFill, washStyle]} pointerEvents="none">
          <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.stage}>
          {CLOUDS.map((_, i) => (
            <Cloud key={i} i={i} gather={gather} color={voz.clouds[i] ?? voz.mic[1]} w={w} h={h} />
          ))}
          {Array.from({ length: PIECES }, (_, i) => (
            <Piece key={i} i={i} burst={burst} color={palette[i % palette.length]} />
          ))}
          <Animated.View entering={ZoomIn.springify().damping(11).delay(900)}>
            {mascot.unlocked ? (
              <Mascota seed={mascot.seed} size={210} mood="feliz" />
            ) : (
              <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.blob} />
            )}
          </Animated.View>
        </View>
        <Animated.View entering={FadeInUp.delay(1250).duration(450)} style={styles.bubble}>
          <Text style={styles.title} accessibilityRole="header">
            {t('celebrate.title')}
          </Text>
          <Text style={styles.body}>{t('celebrate.body', { n: done })}</Text>
          {streak > 0 ? <Text style={styles.streak}>{t('celebrate.streak', { n: streak })}</Text> : null}
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(1500).duration(400)} style={{ alignSelf: 'stretch' }}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
            <Text style={styles.btnText}>{t('celebrate.cta')}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 22 },
  stage: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  cloud: { position: 'absolute', left: '50%', top: '50%' },
  piece: { position: 'absolute' },
  blob: { width: 150, height: 150, borderRadius: 75 },
  bubble: { alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1.1, color: colors.ink, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  streak: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 4 },
  btn: { minHeight: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
});
