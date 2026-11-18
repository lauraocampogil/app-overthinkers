import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChartIcon, HomeIcon, TargetIcon } from '@/components/Iconos';
import { MicIcon, PlusIcon } from '@/components/ui';
import { t } from '@/i18n';
import { useVoz } from '@/lib/paleta';
import { colors } from '@/theme';

/**
 * Floating bottom navigation: "+" on the left, the three places in one pill, the big mic on the right.
 * Nothing behind it: the content scrolls underneath and stays visible around the buttons.
 */
export type Tab = 'hoy' | 'metas' | 'progreso';
const ROUTES: Record<Tab, '/' | '/metas' | '/progreso'> = { hoy: '/', metas: '/metas', progreso: '/progreso' };

/** Frosted glass for the light buttons, so the list underneath does not fight with them. */
function Glass({ style, children }: { style: object; children: React.ReactNode }) {
  return (
    <View style={[style, styles.glassEdge]}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
      {children}
    </View>
  );
}

export function Barra({ active, onWrite }: { active: Tab; onWrite?: () => void }) {
  const voz = useVoz();
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

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, 14) }]} pointerEvents="box-none">
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.write')}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            (onWrite ?? (() => router.push('/escribir')))();
          }}
          style={({ pressed }) => pressed && { transform: [{ scale: 0.95 }] }}
        >
          <Glass style={styles.round}>
            <PlusIcon />
          </Glass>
        </Pressable>
        <Glass style={styles.pill}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {tab('hoy', t('tab.today'), HomeIcon)}
            {tab('metas', t('tab.goals'), TargetIcon)}
            {tab('progreso', t('tab.progress'), ChartIcon)}
          </View>
        </Glass>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.speak')}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/escuchando');
        }}
        style={({ pressed }) => [styles.micWrap, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mic}>
          <MicIcon size={30} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glassEdge: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.12)' },
  glassTint: { backgroundColor: 'rgba(255,255,255,0.72)' },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 60, borderRadius: 30, justifyContent: 'center' },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  tab: { width: 50, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.ink },
  micWrap: { borderRadius: 38, overflow: 'hidden' },
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
});
