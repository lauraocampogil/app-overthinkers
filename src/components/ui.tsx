import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { colors, fonts, gradients } from '@/theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <LinearGradient colors={gradients.background} locations={[0, 0.45, 1]} style={{ flex: 1 }}>
      <Glows />
      <SafeAreaView style={[{ flex: 1 }, style]} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Two soft, static colour glows (peach and pink) at the top, like the voice screen but calmer. */
function Glows() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glowPeach" cx="85%" cy="4%" r="55%">
            <Stop offset="0" stopColor={colors.peach} stopOpacity="0.45" />
            <Stop offset="1" stopColor={colors.peach} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowPink" cx="5%" cy="18%" r="60%">
            <Stop offset="0" stopColor={colors.pink} stopOpacity="0.32" />
            <Stop offset="1" stopColor={colors.pink} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowLilac" cx="60%" cy="100%" r="65%">
            <Stop offset="0" stopColor={colors.lilac} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.lilac} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glowPeach)" />
        <Rect width="100%" height="100%" fill="url(#glowPink)" />
        <Rect width="100%" height="100%" fill="url(#glowLilac)" />
      </Svg>
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
      {dark ? (
        <View style={[styles.primary, { backgroundColor: colors.ink }]}>
          <Text style={styles.primaryText}>{label}</Text>
        </View>
      ) : (
        <LinearGradient colors={gradients.action} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
          <Text style={styles.primaryText}>{label}</Text>
        </LinearGradient>
      )}
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
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** The floating glass navbar: write (+) and speak (gradient mic). */
export function Dock({ onWrite, onSpeak }: { onWrite: () => void; onSpeak: () => void }) {
  return (
    <View style={styles.dockShadow}>
      <BlurView intensity={40} tint="light" style={styles.dock}>
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
          <LinearGradient colors={gradients.mic} style={[styles.dockBtn, styles.dockMic]}>
            <MicIcon />
          </LinearGradient>
        </Pressable>
      </BlurView>
    </View>
  );
}

export const PlusIcon = ({ color = colors.ink }: { color?: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const MicIcon = ({ color = colors.white }: { color?: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={2} />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const BackIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M15 6l-6 6 6 6" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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
    <Path d={down ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} stroke={down ? colors.ink : colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const FlameIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const styles = StyleSheet.create({
  primaryWrap: { borderRadius: 29, shadowColor: colors.accentDark, shadowOpacity: 0.3, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  primary: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.medium, fontSize: 17, color: colors.white },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { fontFamily: fonts.regular, fontSize: 15 },
  dockShadow: { alignSelf: 'center', borderRadius: 40, shadowColor: '#503CC8', shadowOpacity: 0.18, shadowRadius: 17, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  dock: { flexDirection: 'row', gap: 6, padding: 6, borderRadius: 40, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.55)' },
  dockBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  dockWrite: { backgroundColor: colors.white },
  dockMic: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
});

export const PersonIcon = ({ color = colors.ink }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke={color} strokeWidth={1.8} />
    <Path d="M4.5 20c1.2-3.3 4-5 7.5-5s6.3 1.7 7.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);
