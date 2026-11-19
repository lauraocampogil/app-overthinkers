import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CloseIcon, IconCircle, PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import type { NonNeg } from '@/lib/types';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Your non-negotiables: 1 to 3 small things you do every day, whatever happens.
 * They appear every morning at the top of Hoy, on their own, and grow your Okio more than anything.
 * Small on purpose: something you can do even on your worst day.
 */
const SUGGESTIONS = ['nn.s.steps', 'nn.s.read', 'nn.s.water', 'nn.s.journal', 'nn.s.stretch', 'nn.s.sleep', 'nn.s.walk', 'nn.s.noPhone'];
const newId = () => Math.random().toString(36).slice(2, 10);

export default function NoNegociables() {
  const saved = useDay((s) => s.nonNeg) ?? [];
  const [items, setItems] = useState<NonNeg[]>(saved);
  const [text, setText] = useState('');
  const full = items.length >= 3;

  const add = (v: string) => {
    const value = v.trim();
    if (!value || full || items.some((x) => x.text.toLowerCase() === value.toLowerCase())) return;
    setItems([...items, { id: newId(), text: value, minutes: null, proof: null }]);
    setText('');
  };

  const save = () => {
    useDay.getState().setNonNeg(items);
    router.back();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()} size={34}>
          <CloseIcon />
        </IconCircle>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={type.title} accessibilityRole="header">
            {t('nn.title')}
          </Text>
          <Text style={type.muted}>{t('nn.body')}</Text>

          {items.map((n) => (
            <View key={n.id} style={styles.item}>
              <Text style={styles.itemText}>{n.text}</Text>
              <View style={styles.itemRow}>
                <Text style={styles.small}>{t('nn.photo')}</Text>
                <Switch
                  value={!!n.proof}
                  onValueChange={(v) => setItems(items.map((x) => (x.id === n.id ? { ...x, proof: v ? t('nn.photoProof') : null } : x)))}
                  trackColor={{ true: colors.ink }}
                  accessibilityLabel={t('nn.photo')}
                />
                <Pressable onPress={() => setItems(items.filter((x) => x.id !== n.id))} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.remove}>{t('common.delete')}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {!full ? (
            <>
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => add(text)}
                placeholder={t('nn.placeholder')}
                placeholderTextColor={colors.faint}
                style={styles.input}
                returnKeyType="done"
                accessibilityLabel={t('nn.placeholder')}
              />
              <Text style={styles.small}>{t('nn.ideas')}</Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map((k) => (
                  <Pressable key={k} onPress={() => add(t(k))} style={styles.chip} accessibilityRole="button">
                    <Text style={styles.chipText}>{t(k)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={type.muted}>{t('nn.full')}</Text>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t('nn.save')} onPress={save} dark />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, minHeight: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  item: { backgroundColor: colors.card, borderRadius: 20, padding: 16, gap: 8 },
  itemText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  small: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
  remove: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger },
  input: { minHeight: 50, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
