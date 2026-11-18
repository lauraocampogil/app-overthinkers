import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/**
 * The GetGo mark: a G whose bar keeps going as an arrow — from going round in circles to getting going.
 * Same paths as assets/brand/icon.svg (viewBox 1024).
 */
export const MARK = {
  arc: 'M514.1,370.8 A190,190 0 1 0 577,512',
  bar: 'M407,512 L827,512',
  head: 'M759,444 L827,512 L759,580',
  stroke: 86,
};

export function Mark({ size = 48, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
      {[MARK.arc, MARK.bar, MARK.head].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={MARK.stroke} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Mark + wordmark, for headers and the paywall. */
export function Logo({ height = 32, color = colors.ink, style }: { height?: number; color?: string; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: height * 0.12 }, style]} accessible accessibilityLabel="GetGo">
      <Mark size={height * 1.7} color={color} />
      <Text style={{ fontFamily: fonts.bold, fontSize: height, letterSpacing: -height * 0.05, color, marginLeft: -height * 0.35 }}>getgo</Text>
    </View>
  );
}
