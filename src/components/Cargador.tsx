import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { colors } from '@/theme';

/**
 * Calm loader: a ring that turns while GetGo sorts the day.
 * Grey until the person has their mascot; then in their own colours.
 */
export function Cargador({ size = 120 }: { size?: number }) {
  const mascot = useMascot();
  const voz = useVoz();
  const [a, b] = mascot.unlocked ? [voz.mic[0], voz.mic[2]] : ['#C9C9C9', colors.ink];
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [spin, breathe]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + breathe.value * 0.25 }], opacity: 0.5 + breathe.value * 0.5 }));
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar">
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, ring]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={a} stopOpacity="0.15" />
              <Stop offset="1" stopColor={b} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={5} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#cg)" strokeWidth={5} strokeLinecap="round" fill="none" strokeDasharray={`${c * 0.32} ${c}`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ width: size * 0.18, height: size * 0.18, borderRadius: size, backgroundColor: b }, dot]} />
    </View>
  );
}
