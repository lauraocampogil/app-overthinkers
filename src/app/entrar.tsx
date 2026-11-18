import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Ondas } from '@/components/Ondas';
import { Screen } from '@/components/ui';
import { t } from '@/i18n';
import { signInWithApple, signInWithGoogle, type AuthResult } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts, type } from '@/theme';

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

const GoogleG = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48">
    <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </Svg>
);

export default function Entrar() {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [message, setMessage] = useState<string | null>(supabase ? null : t('auth.noServer'));
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    // The free-signing build can't use Sign in with Apple (app.config.ts sets extra.appleSignIn = false).
    const allowed = Constants.expoConfig?.extra?.appleSignIn !== false;
    if (Platform.OS === 'ios' && allowed) AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  const run = async (which: 'google' | 'apple') => {
    if (busy) return;
    setBusy(which);
    setMessage(null);
    const result: AuthResult = which === 'google' ? await signInWithGoogle() : await signInWithApple();
    setBusy(null);
    // On success the layout swaps this screen for the app by itself.
    if (result === 'failed') setMessage(t('auth.failed'));
    if (result === 'noServer') setMessage(t('auth.noServer'));
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.brand}>GetGo</Text>
        <Text style={type.title} accessibilityRole="header">{t('auth.title')}</Text>
        <Text style={type.muted}>{t('auth.subtitle')}</Text>
      </View>

      <View style={styles.center}>
        <Ondas mode="calma" height={260} />
      </View>

      <View style={styles.actions}>
        {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}

        {appleAvailable ? (
          <View style={{ opacity: busy ? 0.6 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={28}
              style={styles.apple}
              onPress={() => run('apple')}
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.google')}
          accessibilityState={{ busy: busy === 'google', disabled: !!busy }}
          disabled={!!busy}
          onPress={() => run('google')}
          style={({ pressed }) => [styles.google, { opacity: busy && busy !== 'google' ? 0.6 : pressed ? 0.85 : 1 }]}
        >
          {busy === 'google' ? <ActivityIndicator color={colors.ink} /> : <GoogleG />}
          <Text style={styles.googleText}>{t('auth.google')}</Text>
        </Pressable>

        <Text style={styles.legal}>
          {t('auth.legal')}
          {PRIVACY_URL ? (
            <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}> {t('auth.privacy')}</Text>
          ) : null}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 24, marginTop: 40, gap: 10 },
  brand: { fontFamily: fonts.semibold, fontSize: 17, color: colors.accentDark, marginBottom: 6 },
  center: { flex: 1, justifyContent: 'center' },
  actions: { paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  message: { ...type.muted, fontSize: 14, textAlign: 'center', marginBottom: 4 },
  apple: { height: 56, width: '100%' },
  google: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(10,10,10,0.08)',
  },
  googleText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  legal: { ...type.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  link: { color: colors.accentDark, fontFamily: fonts.medium },
});
