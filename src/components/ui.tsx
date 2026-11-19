import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

/** `tabs`: screens with the floating bottom bar keep no bottom inset, so the content scrolls behind the bar. */
export function Screen({ children, style, tabs = false }: { children: ReactNode; style?: ViewStyle; tabs?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={[{ flex: 1 }, style]} edges={tabs ? ['top'] : ['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const tap = () => void Haptics.selectionAsync().catch(() => {});

export function PrimaryButton({ label, onPress, dark = false, disabled = false }: {
  label: string; onPress: () => void; dark?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.primaryWrap, { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.primary, { backgroundColor: dark ? colors.accentLight : colors.ink }]}>
        <Text style={styles.primaryText}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function TextButton({ label, onPress, color = colors.muted }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton} hitSlop={8}>
      <Text style={[styles.textButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconCircle({ label, onPress, children, size = 44 }: {
  label: string; onPress: () => void; children: ReactNode; size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** The floating glass navbar: write (+) and speak (gradient mic). */
export function Dock({ onWrite, onSpeak }: { onWrite: () => void; onSpeak: () => void }) {
  const voz = useVoz();
  return (
    <View style={styles.dock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.write')}
          onPress={() => {
            tap();
            onWrite();
          }}
          style={({ pressed }) => [styles.dockBtn, styles.dockWrite, pressed && { opacity: 0.85 }]}
        >
          <PlusIcon />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.speak')}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onSpeak();
          }}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
        >
          <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.dockBtn, styles.dockMic]}>
            <MicIcon />
          </LinearGradient>
        </Pressable>
    </View>
  );
}

export const PlusIcon = ({ color = colors.ink }: { color?: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const MicIcon = ({ color = colors.white, size = 24 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={2} />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const BackIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M15 6l-6 6 6 6" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Chevron pointing right or left, same stroke as BackIcon (pairs nicely for prev / next). */
export const NavChevron = ({ dir = 'right', size = 18 }: { dir?: 'left' | 'right'; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d={dir === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CloseIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const CheckIcon = ({ color = colors.accent, size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronIcon = ({ down = false }: { down?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d={down ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} stroke={down ? colors.ink : colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const FlameIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const styles = StyleSheet.create({
  primaryWrap: { borderRadius: 29 },
  primary: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { fontFamily: fonts.regular, fontSize: 15 },
  dockShadow: { alignSelf: 'center', borderRadius: 40, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  // The two buttons float on the background: no box behind them.
  dock: { flexDirection: 'row', gap: 14, alignSelf: 'center' },
  dockBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  dockWrite: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  dockMic: {},
});

export const PersonIcon = ({ color = colors.ink }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke={color} strokeWidth={1.8} />
    <Path d="M4.5 20c1.2-3.3 4-5 7.5-5s6.3 1.7 7.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);
