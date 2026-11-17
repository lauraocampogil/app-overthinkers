import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter-tight';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { isoDay } from '@/lib/streak';
import { pullDay } from '@/lib/sync';
import { useDay } from '@/store/day';

export default function RootLayout() {
  const [loaded] = useFonts({ InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold });
  const rollOver = useDay((s) => s.rollOverIfNewDay);
  const adoptUser = useDay((s) => s.adoptUser);
  const { session, ready } = useAuth();
  const userId = session?.user.id ?? null;
  const signedIn = userId !== null;

  // Unfinished tasks from yesterday move to "En espera" when a new day starts.
  useEffect(() => {
    rollOver();
  }, [rollOver]);

  // After sign-in: this account's data (from the server if it exists) replaces anyone else's on this phone.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    pullDay(userId, isoDay(new Date())).then((remote) => alive && adoptUser(userId, remote));
    return () => {
      alive = false;
    };
  }, [userId, adoptUser]);

  if (!loaded || !ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'fade' }}>
        {/* An account is required: without a session only the sign-in screen exists. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="escuchando" options={{ gestureEnabled: false }} />
          <Stack.Screen name="escribir" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ordenando" options={{ gestureEnabled: false }} />
          <Stack.Screen name="resumen" />
          <Stack.Screen name="ahora" />
          <Stack.Screen name="no-puedo" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="hecho" options={{ gestureEnabled: false }} />
          <Stack.Screen name="racha" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cuenta" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
