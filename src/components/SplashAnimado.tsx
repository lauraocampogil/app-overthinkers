import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { MARK } from '@/components/Logo';
import { colors, fonts } from '@/theme';

/** Same size as the native splash image (app.json → expo-splash-screen imageWidth), so the hand-over is invisible. */
const NATIVE = 220;

/**
 * After the static native splash: the arrow of the mark gives a little push, the mark slides left and
 * "getgo" appears next to it, then everything fades into the app. About 1.6 s.
 */
export function SplashAnimado({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const push = useSharedValue(0);
  const slide = useSharedValue(0);
  const word = useSharedValue(0);
  const out = useSharedValue(1);
  // The parent re-renders while the app boots: keep the latest callback without restarting the animation.
  const done = useRef(onDone);
  done.current = onDone;
  const finish = () => done.current();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
    push.value = withSequence(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 7, stiffness: 160 }));
    slide.value = withDelay(320, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    word.value = withDelay(480, withTiming(1, { duration: 420 }));
    out.value = withDelay(1250, withTiming(0, { duration: 380 }, (fin) => fin && runOnJS(finish)()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shift = Math.min(96, width * 0.22);
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -shift * slide.value }, { scale: 1 - 0.18 * slide.value }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateX: push.value * 10 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateX: shift * 0.55 + (1 - word.value) * 18 }] }));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  const stroke = { stroke: colors.ink, strokeWidth: MARK.stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, wrapStyle]} pointerEvents="none">
      <Animated.View style={[styles.center, markStyle]}>
        <Svg width={NATIVE} height={NATIVE} viewBox="0 0 1024 1024">
          <Path d={MARK.arc} {...stroke} />
          <Path d={MARK.bar} {...stroke} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
          <Svg width={NATIVE} height={NATIVE} viewBox="0 0 1024 1024">
            <Path d={MARK.head} {...stroke} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.word, wordStyle]}>getgo</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  center: { position: 'absolute', width: NATIVE, height: NATIVE },
  word: { position: 'absolute', fontFamily: fonts.bold, fontSize: 40, letterSpacing: -2, color: colors.ink },
});
