import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChartIcon, HomeIcon, TargetIcon } from '@/components/Iconos';
import { MicIcon, PlusIcon } from '@/components/ui';
import { t } from '@/i18n';
import { useVoz } from '@/lib/paleta';
import { colors, fonts } from '@/theme';

/**
 * Bottom bar: the two main actions (write + speak) in the middle, the three places around them.
 */
export type Tab = 'hoy' | 'metas' | 'progreso';
const ROUTES: Record<Tab, '/' | '/metas' | '/progreso'> = { hoy: '/', metas: '/metas', progreso: '/progreso' };

export function Barra({ active, onWrite }: { active: Tab; onWrite?: () => void }) {
  const voz = useVoz();
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
        style={styles.tab}
        hitSlop={4}
      >
        <Icon color={on ? colors.ink : colors.faint} size={22} strokeWidth={on ? 2.1 : 1.8} />
        <Text style={[styles.tabText, on && { color: colors.ink }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="tablist">
        {tab('hoy', t('tab.today'), HomeIcon)}
        {tab('metas', t('tab.goals'), TargetIcon)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.write')}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            (onWrite ?? (() => router.push('/escribir')))();
          }}
          style={({ pressed }) => [styles.action, styles.plus, pressed && { opacity: 0.8 }]}
        >
          <PlusIcon />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.speak')}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/escuchando');
          }}
          style={({ pressed }) => [pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
            <MicIcon />
          </LinearGradient>
        </Pressable>
        {tab('progreso', t('tab.progress'), ChartIcon)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 40,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tab: { width: 62, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabText: { fontFamily: fonts.medium, fontSize: 11, color: colors.faint },
  action: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  plus: { backgroundColor: colors.card },
});
