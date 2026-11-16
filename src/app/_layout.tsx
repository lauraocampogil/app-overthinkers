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

import { useDay } from '@/store/day';

export default function RootLayout() {
  const [loaded] = useFonts({ InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold });
  const rollOver = useDay((s) => s.rollOverIfNewDay);

  // Unfinished tasks from yesterday move to "En espera" when a new day starts.
  useEffect(() => {
    rollOver();
  }, [rollOver]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="escuchando" options={{ gestureEnabled: false }} />
        <Stack.Screen name="escribir" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ordenando" options={{ gestureEnabled: false }} />
        <Stack.Screen name="resumen" />
        <Stack.Screen name="ahora" />
        <Stack.Screen name="no-puedo" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="hecho" options={{ gestureEnabled: false }} />
        <Stack.Screen name="racha" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
