import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { colors, fonts } from '@/theme';

/** "Hoy | Metas" switch at the top of the two main screens. */
export function Pestanas({ active }: { active: 'hoy' | 'metas' }) {
  const tabs = [
    { key: 'hoy' as const, label: t('tab.today'), href: '/' as const },
    { key: 'metas' as const, label: t('tab.goals'), href: '/metas' as const },
  ];
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => !on && router.replace(tab.href)}
            style={[styles.tab, on && styles.on]}
            hitSlop={4}
          >
            <Text style={[styles.text, on && { color: colors.ink }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)' },
  tab: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center' },
  on: { backgroundColor: colors.white },
  text: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
});
