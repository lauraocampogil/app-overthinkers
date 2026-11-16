import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { CloseIcon, IconCircle, PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

export default function Escribir() {
  const draft = useDay((s) => s.draft);
  const setDraft = useDay((s) => s.setDraft);
  const [text, setText] = useState(draft);

  const go = () => {
    setDraft(text.trim());
    router.replace('/ordenando');
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <IconCircle label={t('common.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconCircle>
        </View>
        <View style={styles.body}>
          <Text style={type.title} accessibilityRole="header">{t('write.title')}</Text>
          <Text style={type.muted}>{t('write.hint')}</Text>
          <TextInput
            accessibilityLabel={t('write.inputLabel')}
            value={text}
            onChangeText={setText}
            autoFocus
            multiline
            placeholder={t('write.placeholder')}
            placeholderTextColor={colors.faint}
            style={styles.input}
            textAlignVertical="top"
          />
        </View>
        <View style={styles.footer}>
          <PrimaryButton label={t('write.cta')} onPress={go} disabled={text.trim().length < 3} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, marginTop: 8 },
  body: { flex: 1, paddingHorizontal: 24, marginTop: 28, gap: 12 },
  input: {
    flex: 1,
    marginTop: 8,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.white,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
  },
  footer: { padding: 24, paddingTop: 16 },
});
