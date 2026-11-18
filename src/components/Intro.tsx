import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { CameraIcon, LockIcon, PlayIcon } from '@/components/Iconos';
import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { PrimaryButton, TextButton } from '@/components/ui';
import { t } from '@/i18n';
import { useVoz } from '@/lib/paleta';
import { colors, fonts, type } from '@/theme';

/**
 * What GetGo does, in four swipes, before signing in.
 * Each slide shows the real thing in small (the wave, the top 3, the focus button, a mascot).
 */
const SLIDES = ['dump', 'decide', 'do', 'mascot'] as const;

export function Intro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const voz = useVoz();
  const next = () => {
    if (i >= SLIDES.length - 1) return onDone();
    ref.current?.scrollTo({ x: width * (i + 1), animated: true });
    setI(i + 1);
  };

  const art = (s: (typeof SLIDES)[number]) => {
    switch (s) {
      case 'dump':
        return <Ondas mode="habla" height={300} />;
      case 'decide':
        return (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.top3}>
            <Text style={styles.top3Label}>{t('top.title').toUpperCase()}</Text>
            {[t('intro.ex1'), t('intro.ex2'), t('intro.ex3')].map((x, k) => (
              <View key={x} style={styles.top3Row}>
                <Text style={styles.top3Num}>{k + 1}</Text>
                <Text style={styles.top3Text}>{x}</Text>
                <View style={styles.top3Check} />
              </View>
            ))}
          </Animated.View>
        );
      case 'do':
        return (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.doRow}>
            <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.play}>
              <PlayIcon size={40} />
            </LinearGradient>
            <View style={styles.side}>
              <View style={styles.bubble}>
                <CameraIcon size={26} />
              </View>
              <View style={styles.bubble}>
                <LockIcon size={24} />
              </View>
            </View>
          </Animated.View>
        );
      case 'mascot':
        return <Mascota seed="getgo-intro" size={240} mood="feliz" />;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, k) => (
          <View key={s} style={{ width, flex: 1 }}>
            <View style={styles.art}>{k === i || Math.abs(k - i) === 1 ? art(s) : null}</View>
            {k === i ? (
              <Animated.View entering={FadeInDown.duration(450)} style={styles.copy}>
                <Text style={type.title} accessibilityRole="header">
                  {t(`intro.${s}.title`)}
                </Text>
                <Text style={[type.muted, { fontSize: 17, lineHeight: 24 }]}>{t(`intro.${s}.body`)}</Text>
              </Animated.View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={t('ob.progress', { i: i + 1, n: SLIDES.length })}>
          {SLIDES.map((s, k) => (
            <Pressable
              key={s}
              onPress={() => {
                ref.current?.scrollTo({ x: width * k, animated: true });
                setI(k);
              }}
              hitSlop={8}
            >
              <View style={[styles.dot, k === i && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        <PrimaryButton label={i === SLIDES.length - 1 ? t('intro.start') : t('ob.next')} onPress={next} />
        <TextButton label={t('intro.haveAccount')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 360, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  copy: { paddingHorizontal: 28, gap: 12 },
  footer: { paddingHorizontal: 24, paddingBottom: 8, gap: 6 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { width: 22, backgroundColor: colors.ink },
  top3: { width: 300, backgroundColor: colors.ink, borderRadius: 28, padding: 20, gap: 4 },
  top3Label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, color: '#8A8A8A', marginBottom: 6 },
  top3Row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A2A2A' },
  top3Num: { width: 18, fontFamily: fonts.bold, fontSize: 22, color: colors.white },
  top3Text: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
  top3Check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#5E5E5E' },
  doRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  play: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  side: { gap: 14 },
  bubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
