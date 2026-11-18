import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/Iconos';
import { CloseIcon } from '@/components/ui';
import { t } from '@/i18n';
import { hideTodaysRead, loadTodaysRead, useMentor } from '@/lib/mentor';
import { todayIso } from '@/store/day';
import { colors, fonts } from '@/theme';

/** "Today's Read": two calm lines from Okio about the day, written once each morning. Tap to talk to Okio. */
export function LecturaHoy({ ready }: { ready: boolean }) {
  const read = useMentor((s) => s.read);
  const readOn = useMentor((s) => s.readOn);
  const hidden = useMentor((s) => s.readHidden);
  const day = todayIso();

  useEffect(() => {
    if (ready && readOn !== day) void loadTodaysRead();
  }, [ready, readOn, day]);

  if (hidden === day || readOn !== day || !read) return null;
  return (
    <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOut.duration(200)} style={styles.card}>
      <Pressable onPress={() => router.push('/mentor')} style={{ gap: 6 }} accessibilityRole="button" accessibilityHint={t('read.talk')}>
        <View style={styles.head}>
          <Text style={styles.label}>{t('read.title').toUpperCase()}</Text>
          <Pressable onPress={hideTodaysRead} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <CloseIcon />
          </Pressable>
        </View>
        <Text style={styles.text}>{read}</Text>
        <View style={styles.talk}>
          <Text style={styles.talkText}>{t('read.talk')}</Text>
          <ArrowRightIcon size={13} color={colors.ink} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, padding: 16, borderRadius: 22, backgroundColor: colors.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.6, color: colors.muted },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink },
  talk: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  talkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
});
