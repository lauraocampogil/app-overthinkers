import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/** Circular progress ring (black, or the person's colour), optionally with something inside (the mascot, a percentage). */
export function Anillo({
  progress,
  size = 96,
  stroke = 8,
  children,
  label,
  color = colors.ink,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
  /** Ring colour: black by default, the person's colour around the mascot. */
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {children ?? (label ? <Text style={[styles.label, { fontSize: size / 4.4 }]}>{label}</Text> : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, color: colors.ink },
});
