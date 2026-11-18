import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useVoz } from '@/lib/paleta';

/**
 * Full-screen, slowly drifting mesh gradient for the listening screen.
 * Soft colour clouds float around; they swell a little with the voice level.
 */

/** Positions and motion of the clouds; their colours come from the person's voice palette. */
const BLOBS = [
  { color: '#FF9EC4', x: 0.1, y: 0.1, r: 0.95, dx: 0.18, dy: 0.12, ms: 9000 }, // pink
  { color: '#FFB48A', x: 0.85, y: 0.05, r: 0.8, dx: -0.15, dy: 0.18, ms: 11000 }, // peach
  { color: '#8B5CFF', x: 0.9, y: 0.6, r: 1.0, dx: -0.2, dy: -0.12, ms: 10000 }, // violet
  { color: '#C77DFF', x: 0.15, y: 0.75, r: 0.9, dx: 0.16, dy: -0.15, ms: 12000 }, // lilac
  { color: '#5B2FE6', x: 0.5, y: 1.05, r: 0.85, dx: 0.1, dy: -0.1, ms: 13000 }, // deep purple
];

function Blob({ color, x, y, r, dx, dy, ms, i, w, h, level }: (typeof BLOBS)[number] & { i: number; w: number; h: number; level: SharedValue<number> }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(i * 300, withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [i, ms, p]);
  const size = r * w * 1.6;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x * w - size / 2 + dx * w * p.value },
      { translateY: y * h - size / 2 + dy * h * p.value },
      { scale: 1 + level.value * 0.25 },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`g${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.9" />
            <Stop offset="0.35" stopColor={color} stopOpacity="0.6" />
            <Stop offset="0.7" stopColor={color} stopOpacity="0.18" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#g${i})`} />
      </Svg>
    </Animated.View>
  );
}

export function Degradado({ level = 0 }: { level?: number }) {
  const voz = useVoz();
  const { width: w, height: h } = useWindowDimensions();
  const lv = useSharedValue(0);
  useEffect(() => {
    lv.value = withTiming(level, { duration: 180 });
  }, [level, lv]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {BLOBS.map((b, i) => (
        <Blob key={i} {...b} color={voz.clouds[i] ?? b.color} i={i} w={w} h={h} level={lv} />
      ))}
      {/* Frosted glass on top: melts the colour clouds together and keeps the text readable. */}
      <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
    </View>
  );
}
