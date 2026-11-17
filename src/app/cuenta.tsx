import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackIcon, IconCircle, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { Mascota } from '@/components/Mascota';
import { deleteAccount, signOut, useAuth, useMascot } from '@/lib/auth';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

export default function Cuenta() {
  const user = useAuth((s) => s.session?.user);
  const reset = useDay((s) => s.reset);
  const [deleting, setDeleting] = useState(false);
  const mascot = useMascot();

  const name = (user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined);
  const email = user?.email ?? '';
  const provider = user?.app_metadata?.provider === 'apple' ? 'Apple' : 'Google';

  const confirmDelete = () =>
    Alert.alert(t('account.deleteTitle'), t('account.deleteBody'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const ok = await deleteAccount();
          setDeleting(false);
          if (ok) reset();
          else Alert.alert(t('account.deleteFailed'));
        },
      },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.back')} onPress={() => router.back()}>
          <BackIcon />
        </IconCircle>
      </View>
      <View style={styles.body}>
        <Text style={type.title} accessibilityRole="header">{t('account.title')}</Text>

        <View style={styles.card}>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          {email ? <Text style={styles.email}>{email}</Text> : null}
          <Text style={styles.provider}>{t('account.via', { provider })}</Text>
        </View>

        <View style={[styles.card, { alignItems: 'center' }]}>
          {mascot.unlocked ? (
            <>
              <Mascota seed={mascot.seed} size={140} />
              <Text style={[type.muted, { textAlign: 'center' }]}>{t('mascot.yours')}</Text>
            </>
          ) : (
            <Text style={type.muted}>{t('mascot.soon', { n: mascot.daysLeft })}</Text>
          )}
        </View>

        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.row}>
          <Text style={styles.rowText}>{t('account.signOut')}</Text>
        </Pressable>

        <View style={styles.spacer} />

        <Pressable accessibilityRole="button" onPress={confirmDelete} disabled={deleting} style={styles.danger} hitSlop={8}>
          {deleting ? <ActivityIndicator color="#C2364B" /> : <Text style={styles.dangerText}>{t('account.delete')}</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 4, marginTop: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  email: { ...type.body, color: colors.ink },
  provider: { ...type.muted, fontSize: 13, marginTop: 4 },
  row: { backgroundColor: colors.white, borderRadius: 20, minHeight: 56, justifyContent: 'center', paddingHorizontal: 20 },
  rowText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  spacer: { flex: 1 },
  danger: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 12 },
  dangerText: { fontFamily: fonts.medium, fontSize: 15, color: '#C2364B' },
});
