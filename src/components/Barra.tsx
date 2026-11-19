import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
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

/** Frosted glass for the light buttons, so the list underneath does not fight with them. */
function Glass({ style, children }: { style: object; children: React.ReactNode }) {
  return (
    <View style={[style, styles.glassEdge]}>
      <BlurView intensity={28} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
      {/* A thin light rim on top, like real glass catching the light. */}
      <View style={[StyleSheet.absoluteFill, styles.glassRim]} pointerEvents="none" />
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
        <Icon color={on ? colors.white : colors.muted} size={22} strokeWidth={on ? 2.1 : 1.8} />
      </Pressable>
    );
  };

  const bottom = Math.max(insets.bottom - 6, 14);
  return (
    <>
    {menu ? <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel={t('common.close')} /> : null}
    {menu ? (
      <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} style={[styles.menu, { bottom: bottom + 72 }]}>
        <Pressable onPress={() => pick(false)} accessibilityRole="button">
          <Glass style={styles.menuItem}>
            <CheckLine size={18} color={colors.ink} />
            <Text style={styles.menuText}>{t('plus.task')}</Text>
          </Glass>
        </Pressable>
        <Pressable onPress={() => pick(true)} accessibilityRole="button">
          <Glass style={styles.menuItem}>
            <TargetIcon size={18} color={colors.ink} />
            <Text style={styles.menuText}>{t('plus.goal')}</Text>
          </Glass>
        </Pressable>
        <Pressable
          onPress={() => {
            setMenu(false);
            router.push('/mentor');
          }}
          accessibilityRole="button"
        >
          <Glass style={styles.menuItem}>
            <Mascota seed={mascot.seed} size={22} mood="calma" />
            <Text style={styles.menuText}>Okio</Text>
          </Glass>
        </Pressable>
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
  glassEdge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  glassTint: { backgroundColor: 'rgba(245,245,245,0.38)' },
  glassRim: { borderRadius: 999, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  menu: { position: 'absolute', right: 16, gap: 8, alignItems: 'flex-end' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 18, borderRadius: 25 },
  menuText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 60, borderRadius: 30, justifyContent: 'center' },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  tab: { width: 50, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.ink },
  micWrap: { borderRadius: 30, overflow: 'hidden' },
});
