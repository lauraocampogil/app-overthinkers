import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LockIcon } from '@/components/Iconos';
import { BackIcon, IconCircle, PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { askBlockingPermission, blockingAuthorized, blockingAvailable, blockingLib, SELECTION_ID, useBloqueo } from '@/lib/bloqueo';
import { colors, fonts, type } from '@/theme';

/** Settings for blocking apps during focus: permission, Apple's app picker, on/off. */
export default function Bloqueo() {
  const available = blockingAvailable();
  const { enabled, picked } = useBloqueo();
  const [authorized, setAuthorized] = useState(() => blockingAuthorized());
  const [picker, setPicker] = useState(false);
  const lib = blockingLib();
  const Sheet = lib?.DeviceActivitySelectionSheetViewPersisted;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.back')} onPress={() => router.back()}>
          <BackIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.badge}>
          <LockIcon size={26} color={colors.white} />
        </Animated.View>
        <Text style={type.title} accessibilityRole="header">
          {t('block.title')}
        </Text>
        <Text style={type.muted}>{t('block.body')}</Text>

        {!available ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('block.soonTitle')}</Text>
            <Text style={styles.cardBody}>{t('block.soonBody')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>{t('block.toggle')}</Text>
                <Switch
                  value={enabled && authorized && picked > 0}
                  disabled={!authorized || !picked}
                  onValueChange={(v) => {
                    useBloqueo.setState({ enabled: v });
                  }}
                  trackColor={{ true: colors.ink, false: colors.line }}
                />
              </View>
              <Text style={styles.cardBody}>
                {picked ? t('block.pickedCount', { n: picked }) : t('block.nonePicked')}
              </Text>
            </View>

            {!authorized ? (
              <PrimaryButton
                label={t('block.allow')}
                onPress={async () => {
                  const ok = await askBlockingPermission();
                  setAuthorized(ok);
                }}
              />
            ) : (
              <PrimaryButton label={picked ? t('block.change') : t('block.pick')} onPress={() => setPicker(true)} />
            )}
            <Text style={styles.fine}>{t('block.privacy')}</Text>
          </>
        )}
      </ScrollView>

      {picker && Sheet ? (
        <Sheet
          style={{ width: 1, height: 1, position: 'absolute' }}
          familyActivitySelectionId={SELECTION_ID}
          onSelectionChange={(e) => {
            const m = e.nativeEvent;
            const n = m.applicationCount + m.categoryCount + m.webDomainCount;
            useBloqueo.setState({ picked: n, enabled: n > 0 });
          }}
          onDismissRequest={() => setPicker(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40, gap: 14 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  card: { padding: 18, borderRadius: 22, backgroundColor: colors.card, gap: 6, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  fine: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.faint, textAlign: 'center' },
});
