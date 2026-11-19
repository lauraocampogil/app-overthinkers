import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinear, Path, RadialGradient, Stop } from 'react-native-svg';

import { bondLevel, useVinculo } from '../lib/vinculo';

/**
 * Okio, the personal mascot. It is born grey and gains its colours and its sparkles
 * as the bond with the person grows (see lib/vinculo).
 * A glossy, slowly morphing blob with iridescent edges and two pill eyes.
 * Every account gets its own one: shape, colours, eyes and rhythm come from a seed (the user id).
 */

export type MascotMood = 'calma' | 'escucha' | 'feliz';

type Props = {
  /** Usually the user id. Same seed → same mascot, on every phone. */
  seed: string;
  size?: number;
  mood?: MascotMood;
  /** Live voice level 0..1 while listening: the body ripples more. */
  level?: number;
  /** 0 = grey, 1 = all its colours. Defaults to the person's bond with Okio. */
  bond?: number;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** HSL → hex, so every mascot can get its own exact colour family (not just one of a few presets). */
function hsl(h: number, s: number, l: number) {
  const hh = ((h % 360) + 360) % 360;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Base hues for the colour families: violet, lilac, magenta, berry, indigo, blue. */
const HUES = [258, 272, 292, 318, 238, 222];

/** Small deterministic PRNG so a seed always gives the same mascot. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** The same colour without saturation, `amount` of the way (1 = fully grey). */
export function toGrey(hex: string, amount: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const y = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return `#${rgb.map((v) => Math.round(v + (y - v) * amount).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Same seed → same mascot. `family` (what the person does most, once Okio knows them) replaces
 * the seed's colour family; `bond` 0..1 brings it from grey to its full colours.
 */
export function mascotTraits(seed: string, family: number | null = null, bond = 1) {
  const r = rng(seed || 'getgo');
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  // Family + a personal shift of up to ±14° → practically no two people share the exact colours.
  const seedHue = pick(HUES);
  const hue = (family !== null && HUES[family] !== undefined ? HUES[family] : seedHue) + (r() - 0.5) * 28;
  const g = 1 - Math.max(0, Math.min(1, bond));
  const raw = {
    core: hsl(hue, 55, 40),
    mid: hsl(hue, 70, 58),
    edge: hsl(hue, 85, 76),
    rim: hsl(hue + 18, 95, 92),
    a: hsl(hue - 45, 90, 66),
    b: hsl(hue + 65, 95, 74),
  };
  const palette = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, toGrey(v, g)])) as typeof raw;
  return {
    palette,
    lobes: pick([5, 6, 6, 7]),
    wobble: 0.032 + r() * 0.02,
    twist: r() * Math.PI * 2,
    eyeGap: 9 + r() * 4,
    eyeW: 11 + r() * 2.5,
    eyeH: 18 + r() * 4,
    speed: 8000 + Math.round(r() * 5000),
    blinkEvery: 2800 + Math.round(r() * 2400),
  };
}

const VB = 200; // viewBox size
const C = VB / 2;
const R = 58; // body radius in viewBox units

/** Closed, smooth blob through n points (Catmull-Rom → cubic Bézier). Runs on the UI thread. */
function blob(t: number, lobes: number, wobble: number, twist: number, scale: number, extra: number) {
  'worklet';
  const n = 30;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k =
      1 +
      (wobble + extra) * Math.sin(lobes * a + t + twist) +
      (wobble * 0.35 + extra * 0.6) * Math.sin((lobes - 2) * a - 2 * t) +
      extra * 0.5 * Math.sin((lobes + 3) * a + 3 * t);
    xs.push(C + Math.cos(a) * R * scale * k);
    ys.push(C + Math.sin(a) * R * scale * k);
  }
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = (i - 1 + n) % n;
    const p1 = i;
    const p2 = (i + 1) % n;
    const p3 = (i + 2) % n;
    const c1x = xs[p1] + (xs[p2] - xs[p0]) / 6;
    const c1y = ys[p1] + (ys[p2] - ys[p0]) / 6;
    const c2x = xs[p2] - (xs[p3] - xs[p1]) / 6;
    const c2y = ys[p2] - (ys[p3] - ys[p1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;
  }
  return `${d} Z`;
}

const PARTICLES = [
  { x: 0.16, y: 0.22, s: 3, d: 0 },
  { x: 0.84, y: 0.3, s: 2, d: 900 },
  { x: 0.9, y: 0.68, s: 3, d: 1800 },
  { x: 0.12, y: 0.74, s: 2, d: 2600 },
  { x: 0.7, y: 0.9, s: 2, d: 1300 },
  { x: 0.32, y: 0.08, s: 2, d: 2100 },
];

function Particle({ x, y, s, d, size, color }: { x: number; y: number; s: number; d: number; size: number; color: string }) {
  const o = useSharedValue(0.15);
  useEffect(() => {
    o.value = withDelay(d, withRepeat(withTiming(0.8, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [d, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (o.value - 0.5) * -6 }] }));
  return (
    <Animated.View
      style={[{ position: 'absolute', left: x * size, top: y * size, width: s, height: s, borderRadius: s / 2, backgroundColor: color }, style]}
    />
  );
}

export function Mascota({ seed, size = 260, mood = 'calma', level = 0, bond }: Props) {
  const points = useVinculo((s) => s.points);
  const family = useVinculo((s) => s.family);
  const b = bond ?? bondLevel(points);
  const tr = useMemo(() => mascotTraits(seed, family, b), [seed, family, b]);
  const id = useMemo(() => `m${Math.abs(seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}`, [seed]);

  const t = useSharedValue(0);
  const extra = useSharedValue(0);
  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const look = useSharedValue(0);

  useEffect(() => {
    const fast = mood === 'escucha';
    t.value = 0;
    t.value = withRepeat(withTiming(Math.PI * 2, { duration: fast ? tr.speed / 2.5 : tr.speed, easing: Easing.linear }), -1, false);
    bob.value = withRepeat(withTiming(1, { duration: fast ? 1400 : 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    blink.value = withRepeat(
      withSequence(
        withDelay(tr.blinkEvery, withTiming(0.08, { duration: 80 })),
        withTiming(1, { duration: 120 }),
        withDelay(140, withTiming(0.08, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
      false,
    );
    look.value = withRepeat(
      withSequence(
        withDelay(1800, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) })),
        withDelay(1200, withTiming(-1, { duration: 700, easing: Easing.inOut(Easing.quad) })),
        withDelay(1400, withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) })),
      ),
      -1,
      false,
    );
  }, [mood, tr, t, bob, blink, look]);

  useEffect(() => {
    extra.value = withTiming(mood === 'escucha' ? 0.02 + level * 0.07 : 0, { duration: 160 });
  }, [level, mood, extra]);

  const halo = useAnimatedProps(() => ({ d: blob(t.value * 0.7, tr.lobes, tr.wobble * 0.8, tr.twist + 1, 1.34, extra.value * 0.6) }));
  const body = useAnimatedProps(() => ({ d: blob(t.value, tr.lobes, tr.wobble, tr.twist, 1, extra.value) }));

  const float = useAnimatedStyle(() => ({ transform: [{ translateY: (bob.value - 0.5) * 8 }] }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ translateX: look.value * 4 }, { scaleY: blink.value }] }));

  const u = size / VB; // viewBox unit → px
  const eyeW = tr.eyeW * u;
  const eyeH = tr.eyeH * u;
  const gap = tr.eyeGap * u;
  const { palette } = tr;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessible accessibilityRole="image" accessibilityLabel="Okio">
      {PARTICLES.slice(0, Math.round(b * PARTICLES.length)).map((p, i) => (
        <Particle key={i} {...p} size={size} color={palette.edge} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, float]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          <Defs>
            <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor={palette.mid} stopOpacity="0.16" />
              <Stop offset="1" stopColor="#7C4DFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}b`} cx="52%" cy="56%" r="54%">
              <Stop offset="0" stopColor={palette.core} />
              <Stop offset="0.5" stopColor={palette.mid} />
              <Stop offset="0.82" stopColor={palette.edge} />
              <Stop offset="0.98" stopColor={palette.rim} />
            </RadialGradient>
            <SvgLinear id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.a} stopOpacity="0.75" />
              <Stop offset="0.38" stopColor={palette.a} stopOpacity="0" />
              <Stop offset="0.7" stopColor={palette.b} stopOpacity="0" />
              <Stop offset="1" stopColor={palette.b} stopOpacity="0.55" />
            </SvgLinear>
            <SvgLinear id={`${id}c`} x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.b} stopOpacity="0.5" />
              <Stop offset="0.35" stopColor={palette.b} stopOpacity="0" />
              <Stop offset="0.75" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.35" />
            </SvgLinear>
            <RadialGradient id={`${id}s`} cx="36%" cy="28%" r="30%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <AnimatedPath animatedProps={halo} fill={`url(#${id}h)`} />
          <AnimatedPath animatedProps={body} fill={`url(#${id}b)`} />
          <AnimatedPath animatedProps={body} fill={`url(#${id}a)`} />
          <AnimatedPath animatedProps={body} fill={`url(#${id}c)`} />
          <AnimatedPath animatedProps={body} fill={`url(#${id}s)`} />
        </Svg>

        {mood === 'feliz' ? (
          <View style={[styles.eyes, { gap: gap * 0.9 }]} pointerEvents="none">
            {[0, 1].map((i) => (
              <Svg key={i} width={eyeW * 1.9} height={eyeH} viewBox="0 0 20 14">
                <Path d="M3 11 Q10 1 17 11" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" fill="none" />
              </Svg>
            ))}
          </View>
        ) : (
          <Animated.View style={[styles.eyes, { gap }, eyes]} pointerEvents="none">
            {[0, 1].map((i) => (
              <LinearGradient
                key={i}
                colors={['#FFFFFF', '#EEEAFB']}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={{
                  width: eyeW,
                  height: eyeH,
                  borderRadius: eyeW / 2,
                  shadowColor: palette.core,
                  shadowOpacity: 0.5,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                }}
              />
            ))}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyes: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
