import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, HomeIcon } from '@/components/Iconos';
import { MicIcon, PlusIcon } from '@/components/ui';
import { useState } from 'react';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { Mascota } from '@/components/Mascota';
import { t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

/**
 * Floating bottom navigation: Hoy and Semana (named, so nobody has to guess) in one pill,
 * and "+": a task (say it, write it, snap it) or a talk with Okio. Nothing behind it.
 */
export type Tab = 'hoy' | 'metas' | 'progreso';
const ROUTES: Record<Tab, '/' | '/metas' | '/progreso'> = { hoy: '/', metas: '/metas', progreso: '/progreso' };

/**
 * Frosted glass for the light buttons. Still glass, but readable on anything behind it (white lists, the black
 * top-3 card, photos): a stronger blur with a milky white layer, a fine dark outline that separates it from white,
 * a light rim that separates it from black, and a soft shadow that lifts it off the page.
 * The shadow sits on an outer view so iOS doesn't clip it with the rounded corners.
 */
const LIQUID = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

function Glass({ style, children }: { style: object; children: React.ReactNode }) {
  const radius = (StyleSheet.flatten(style) as { borderRadius?: number }).borderRadius ?? 30;
  // iOS 26+: Apple's own Liquid Glass, exactly like the system tab bar.
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive colorScheme="light" style={[style, { borderRadius: radius, overflow: 'hidden' }]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, styles.glassShadow]}>
      <View style={[StyleSheet.absoluteFill, styles.glassClip, { borderRadius: radius }]} pointerEvents="none">
        <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
        <View style={[StyleSheet.absoluteFill, styles.glassRim, { borderRadius: radius }]} />
      </View>
      {children}
    </View>
  );
}

export function Barra({ active }: { active: Tab; onWrite?: () => void }) {
  const voz = useVoz();
  const mascot = useMascot();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const tab = (key: Tab, label: string, icon: (on: boolean) => React.ReactNode) => {
    const on = active === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        onPress={() => {
          if (on) return;
          void Haptics.selectionAsync().catch(() => {});
          router.replace(ROUTES[key]);
        }}
        style={[styles.tab, on && styles.tabOn]}
        hitSlop={4}
      >
        {icon(on)}
        <Text style={[styles.tabLabel, on && { color: colors.white }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };
  const go = (path: '/escuchando' | '/mentor') => {
    setMenu(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(path);
  };

  const bottom = Math.max(insets.bottom - 6, 14);
  return (
    <>
      {menu ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, styles.scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel={t('common.close')} />
        </Animated.View>
      ) : null}
      {menu ? (
        // A plain white card (not glass): always readable, whatever is behind it.
        <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(140)} style={[styles.menu, { bottom: bottom + 74 }]}>
          <Pressable onPress={() => go('/escuchando')} accessibilityRole="button" style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.card }]}>
            <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.menuIcon}>
              <MicIcon size={18} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>{t('plus.task')}</Text>
              <Text style={styles.menuSub}>{t('plus.taskSub')}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => go('/mentor')} accessibilityRole="button" style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.card }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.card }]}>
              <Mascota seed={mascot.seed} size={30} mood="calma" bond={0} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>{t('plus.okio')}</Text>
              <Text style={styles.menuSub}>{t('plus.okioSub')}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
      <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
        <Glass style={styles.pill}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {tab('hoy', t('tab.today'), (on) => <HomeIcon color={on ? colors.white : colors.ink} size={20} strokeWidth={on ? 2.1 : 1.8} />)}
            {tab('metas', t('tab.week'), (on) => <CalendarIcon color={on ? colors.white : colors.ink} size={20} strokeWidth={on ? 2.1 : 1.8} />)}
          </View>
        </Glass>
        {/* One button for everything you tell Okio: a task (say it, write it, snap it) or a talk with Okio. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('plus.open')}
          accessibilityState={{ expanded: menu }}
          accessibilityHint={t('bar.micHint')}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            setMenu((v) => !v);
          }}
          onLongPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setMenu(false);
            router.push('/escribir');
          }}
          style={({ pressed }) => [styles.micWrap, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.round}>
            <Animated.View style={{ transform: [{ rotate: menu ? '45deg' : '0deg' }] }}>
              <PlusIcon color={colors.white} />
            </Animated.View>
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glassShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  glassClip: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.10)' },
  glassTint: { backgroundColor: 'rgba(255,255,255,0.55)' },
  glassRim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' },
  scrim: { backgroundColor: 'rgba(10,10,10,0.18)' },
  menu: {
    position: 'absolute',
    right: 16,
    width: 250,
    borderRadius: 24,
    backgroundColor: colors.white,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, borderRadius: 18, marginHorizontal: 6 },
  menuDivider: {},
  menuIcon: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  menuText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  menuSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 62, borderRadius: 31, justifyContent: 'center' },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  tab: { minWidth: 66, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: 8 },
  tabLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.ink },
  tabOn: { backgroundColor: colors.ink },
  micWrap: { borderRadius: 30, overflow: 'hidden' },
});
