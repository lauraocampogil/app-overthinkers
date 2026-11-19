import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChartIcon, HomeIcon, TargetIcon } from '@/components/Iconos';
import { CheckIcon as CheckLine } from '@/components/ui';
import { MicIcon, PlusIcon } from '@/components/ui';
import { Mascota } from '@/components/Mascota';
import { t } from '@/i18n';
import { useMascot } from '@/lib/auth';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

/**
 * Floating bottom navigation: the three places in one pill on the left, write (+) and speak (mic) together on the right.
 * Nothing behind it: the content scrolls underneath and stays visible around the buttons.
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
  // "+" asks first: a task or a goal.
  const [menu, setMenu] = useState(false);
  const mascot = useMascot();
  const pick = (meta: boolean) => {
    setMenu(false);
    router.push(meta ? { pathname: '/escribir', params: { meta: '1' } } : '/escribir');
  };
  const insets = useSafeAreaInsets();
  const tab = (key: Tab, label: string, Icon: typeof HomeIcon) => {
    const on = active === key;
    return (
      <Pressable
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
        <Icon color={on ? colors.white : colors.ink} size={22} strokeWidth={on ? 2.1 : 1.8} />
      </Pressable>
    );
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
        {[
          { key: 'task', label: t('plus.task'), sub: t('plus.taskSub'), icon: <CheckLine size={18} color={colors.ink} />, go: () => pick(false) },
          { key: 'goal', label: t('plus.goal'), sub: t('plus.goalSub'), icon: <TargetIcon size={18} color={colors.ink} />, go: () => pick(true) },
          {
            key: 'okio',
            label: 'Okio',
            sub: t('plus.okioSub'),
            icon: <Mascota seed={mascot.seed} size={24} mood="calma" />,
            go: () => {
              setMenu(false);
              router.push('/mentor');
            },
          },
        ].map((it, i) => (
          <Pressable
            key={it.key}
            onPress={it.go}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, i > 0 && styles.menuDivider, pressed && { backgroundColor: colors.card }]}
          >
            <View style={styles.menuIcon}>{it.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>{it.label}</Text>
              <Text style={styles.menuSub}>{it.sub}</Text>
            </View>
          </Pressable>
        ))}
      </Animated.View>
    ) : null}
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Glass style={styles.pill}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {tab('hoy', t('tab.today'), HomeIcon)}
          {tab('metas', t('tab.goals'), TargetIcon)}
          {tab('progreso', t('tab.progress'), ChartIcon)}
        </View>
      </Glass>
      {/* The two ways to tell GetGo something, side by side: write or speak. */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.write')}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            setMenu((v) => !v);
          }}
          onLongPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push({ pathname: '/escribir', params: { snap: '1' } });
          }}
          accessibilityHint={t('write.snapHint')}
          style={({ pressed }) => pressed && { transform: [{ scale: 0.95 }] }}
        >
          <Glass style={styles.round}>
            <PlusIcon />
          </Glass>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.speak')}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/escuchando');
          }}
          style={({ pressed }) => [styles.micWrap, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.round}>
            <MicIcon />
          </LinearGradient>
        </Pressable>
      </View>
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
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  menuText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  menuSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 60, borderRadius: 30, justifyContent: 'center' },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  tab: { width: 50, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.ink },
  micWrap: { borderRadius: 30, overflow: 'hidden' },
});
