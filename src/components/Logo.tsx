import { Text, type TextStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/** The GetGo wordmark: just "getgo" in Geist Bold, tight. The mascot lives in the app icon and the splash. */
export function Logo({ height = 32, color = colors.ink, style }: { height?: number; color?: string; style?: TextStyle }) {
  return (
    <Text accessibilityRole="header" accessibilityLabel="GetGo" style={[{ fontFamily: fonts.bold, fontSize: height, letterSpacing: -height * 0.05, color }, style]}>
      getgo
    </Text>
  );
}

/**
 * The brand mascot in grey, as on the app icon and the splash (same shape formula as Mascota, frozen).
 * Grey on purpose: it becomes each person's own colours once their mascot is unlocked.
 */
export const BRAND_BLOB = (() => {
  const n = 30;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.042 * Math.sin(6 * a + 0.8) + 0.042 * 0.35 * Math.sin(4 * a);
    xs.push(512 + Math.cos(a) * 300 * k);
    ys.push(512 + Math.sin(a) * 300 * k);
  }
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [(i - 1 + n) % n, i, (i + 1) % n, (i + 2) % n];
    d += ` C${(xs[p1] + (xs[p2] - xs[p0]) / 6).toFixed(1)} ${(ys[p1] + (ys[p2] - ys[p0]) / 6).toFixed(1)} ${(xs[p2] - (xs[p3] - xs[p1]) / 6).toFixed(1)} ${(ys[p2] - (ys[p3] - ys[p1]) / 6).toFixed(1)} ${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;
  }
  return `${d} Z`;
})();

/** Eyes of the brand mascot in the 1024 box: two pills, like the mascot's calm eyes. */
const U = 300 / 58;
export const BRAND_EYES = { cy: 512 - 300 * 0.08, gap: 11 * U, w: 12.5 * U, h: 20 * U };

export function MascotaMarca({ size = 220, eyes = true }: { size?: number; eyes?: boolean }) {
  const { cy, gap, w, h } = BRAND_EYES;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <RadialGradient id="mm" cx="36%" cy="28%" r="85%">
          <Stop offset="0" stopColor="#F2F2F2" />
          <Stop offset="0.55" stopColor="#D9D9D9" />
          <Stop offset="1" stopColor="#A6A6A6" />
        </RadialGradient>
      </Defs>
      <Path d={BRAND_BLOB} fill="url(#mm)" />
      {eyes
        ? [512 - gap / 2 - w / 2, 512 + gap / 2 + w / 2].map((x) => <Rect key={x} x={x - w / 2} y={cy - h / 2} width={w} height={h} rx={w / 2} fill={colors.ink} />)
        : null}
    </Svg>
  );
}
