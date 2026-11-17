import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';

export type OndasMode = 'calma' | 'habla' | 'orden' | 'hecho';

const CONFIG: Record<OndasMode, { amps: number[]; speeds: number[]; band: number; core: number }> = {
  calma: { amps: [10, 6, 3], speeds: [9000, 13000, 17000], band: 1, core: 0.55 },
  habla: { amps: [30, 19, 11], speeds: [2600, 3600, 5000], band: 1.15, core: 0.9 },
  orden: { amps: [14, 9, 5], speeds: [5000, 7000, 9000], band: 1.05, core: 0.7 },
  hecho: { amps: [4, 2, 0], speeds: [14000, 18000, 22000], band: 1, core: 0.6 },
};
const STROKES = [2.6, 2, 1.4];
const OPACITIES = [0.95, 0.65, 0.4];
const PHASES = [0, 1.6, 3.1];

type Props = {
  mode: OndasMode;
  height?: number;
  /** Live voice level 0..1 (from the recorder's metering) to make the waves react. */
  level?: number;
  /** Colour behind the component, used to fade the waves at the edges. 'transparent' = no fade (on a gradient). */
  fadeTo?: string;
};

function wavePath(width: number, height: number, amp: number, phase: number) {
  const period = width / 2; // two periods per screen width -> seamless loop when shifted by `width`
  const cy = height / 2;
  let d = '';
  for (let x = 0; x <= width * 2; x += 6) {
    const y = cy + amp * Math.sin((2 * Math.PI * x) / period + phase);
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
  }
  return d;
}

function Wave({ width, height, amp, phase, speed, stroke, opacity }: {
  width: number; height: number; amp: number; phase: number; speed: number; stroke: number; opacity: number;
}) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = 0;
    x.value = withRepeat(withTiming(-width, { duration: speed, easing: Easing.linear }), -1, false);
  }, [speed, width, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const d = useMemo(() => wavePath(width, height, amp, phase), [width, height, amp, phase]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { width: width * 2 }, style]}>
      <Svg width={width * 2} height={height}>
        <Path d={d} stroke={colors.white} strokeWidth={stroke} strokeLinecap="round" fill="none" opacity={opacity} />
      </Svg>
    </Animated.View>
  );
}

export function Ondas({ mode, height = 300, level = 0, fadeTo = 'transparent' }: Props) {
  const { width } = useWindowDimensions();
  const cfg = CONFIG[mode];
  const boost = 1 + Math.min(1, Math.max(0, level)) * 1.4;

  const breathe = useSharedValue(1);
  const spin = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1.06, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
    spin.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false);
  }, [breathe, spin]);
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  const ring = 230;
  const bandRx = width * 0.67 * cfg.band;
  const bandRy = height * 0.36 * cfg.band;

  return (
    <View style={{ width, height, overflow: 'hidden' }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, breatheStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="band" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#6E5BFF" stopOpacity={1} />
              <Stop offset="0.35" stopColor="#8F7DFF" stopOpacity={0.95} />
              <Stop offset="0.7" stopColor="#B4C2FF" stopOpacity={0.6} />
              <Stop offset="1" stopColor="#BECCFF" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="core" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={cfg.core} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={width / 2} cy={height / 2} rx={bandRx} ry={bandRy} fill="url(#band)" />
          <Circle cx={width / 2} cy={height / 2} r={75 * cfg.band} fill="url(#core)" />
        </Svg>
      </Animated.View>

      {(mode === 'orden' || mode === 'hecho') && (
        <Animated.View
          style={[
            { position: 'absolute', width: ring, height: ring, left: width / 2 - ring / 2, top: height / 2 - ring / 2 },
            mode === 'orden' ? spinStyle : null,
          ]}
        >
          <Svg width={ring} height={ring}>
            <Circle cx={ring / 2} cy={ring / 2} r={108} stroke="rgba(255,255,255,0.55)" strokeWidth={2} fill="none" />
            <Circle
              cx={ring / 2}
              cy={ring / 2}
              r={108}
              stroke={colors.white}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={mode === 'hecho' ? '680 0' : '170 510'}
            />
          </Svg>
        </Animated.View>
      )}

      {cfg.amps.map((a, k) => (
        <Wave
          key={k}
          width={width}
          height={height}
          amp={a * boost}
          phase={PHASES[k]}
          speed={cfg.speeds[k]}
          stroke={STROKES[k]}
          opacity={OPACITIES[k]}
        />
      ))}

      {mode === 'hecho' && (
        <View style={{ position: 'absolute', left: width / 2 - 22, top: height / 2 - 22 }}>
          <Svg width={44} height={44} viewBox="0 0 24 24">
            <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </View>
      )}

      {fadeTo !== 'transparent' && (
        <>
          <LinearGradient colors={[fadeTo, `${fadeTo}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { left: 0 }]} />
          <LinearGradient colors={[`${fadeTo}00`, fadeTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { right: 0 }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, bottom: 0, width: 64 },
});
