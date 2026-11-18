import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { BRAND_BLOB, BRAND_EYES } from '@/components/Logo';
import { colors, fonts } from '@/theme';

/** Same size as the native splash image (app.json → expo-splash-screen imageWidth): the hand-over is invisible. */
const NATIVE = 220;
const K = NATIVE / 1024;

/**
 * After the static native splash (the grey mascot): it squishes and bounces, blinks, moves up a little,
 * "getgo" appears under it, then everything fades into the app. About 3 s.
 */
export function SplashAnimado({ onDone }: { onDone: () => void }) {
  const squish = useSharedValue(1);
  const blink = useSharedValue(1);
  const lift = useSharedValue(0);
  const word = useSharedValue(0);
  const out = useSharedValue(1);
  // The parent re-renders while the app boots: keep the latest callback without restarting the animation.
  const done = useRef(onDone);
  done.current = onDone;
  const finish = () => done.current();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    squish.value = withDelay(250, withSequence(withTiming(0.9, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 6, stiffness: 180 })));
    blink.value = withDelay(1000, withSequence(withTiming(0.1, { duration: 90 }), withTiming(1, { duration: 130 }), withDelay(180, withTiming(0.1, { duration: 80 })), withTiming(1, { duration: 120 })));
    lift.value = withDelay(1500, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    word.value = withDelay(1650, withTiming(1, { duration: 500 }));
    out.value = withDelay(2700, withTiming(0, { duration: 420 }, (fin) => fin && runOnJS(finish)()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -46 * lift.value }, { scale: 1 - 0.12 * lift.value }, { scaleX: 2 - squish.value }, { scaleY: squish.value }],
  }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: 82 - (1 - word.value) * 12 }] }));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  const { cy, gap, w, h } = BRAND_EYES;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, wrapStyle]} pointerEvents="none">
      <Animated.View style={[styles.box, bodyStyle]}>
        <Svg width={NATIVE} height={NATIVE} viewBox="0 0 1024 1024">
          <Defs>
            <RadialGradient id="sp" cx="36%" cy="28%" r="85%">
              <Stop offset="0" stopColor="#F2F2F2" />
              <Stop offset="0.55" stopColor="#D9D9D9" />
              <Stop offset="1" stopColor="#A6A6A6" />
            </RadialGradient>
          </Defs>
          <Path d={BRAND_BLOB} fill="url(#sp)" />
        </Svg>
        <Animated.View style={[styles.eyes, { top: (cy - h / 2) * K, gap: gap * K }, eyesStyle]}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: w * K, height: h * K, borderRadius: 99, backgroundColor: colors.ink }} />
          ))}
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.word, wordStyle]}>getgo</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  box: { position: 'absolute', width: NATIVE, height: NATIVE },
  eyes: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  word: { position: 'absolute', fontFamily: fonts.bold, fontSize: 40, letterSpacing: -2, color: colors.ink },
});
