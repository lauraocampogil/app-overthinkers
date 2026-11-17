import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter-tight';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { refreshReminders } from '@/lib/avisos';
import { syncWidget, widgetChanges } from '@/lib/widget';
import { pullDay } from '@/lib/sync';
import { todayList, useDay } from '@/store/day';

export default function RootLayout() {
  const [loaded] = useFonts({ InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold });
  const rollOver = useDay((s) => s.rollOverIfNewDay);
  const adoptUser = useDay((s) => s.adoptUser);
  const { session, ready } = useAuth();
  const userId = session?.user.id ?? null;
  const signedIn = userId !== null;

  // Each new day: unfinished tasks come back to today and the list is re-planned (also when returning to the app).
  useEffect(() => {
    rollOver();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && rollOver());
    return () => sub.remove();
  }, [rollOver]);

  // After sign-in: this account's data (from the server if it exists) replaces anyone else's on this phone.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    pullDay(userId).then((remote) => alive && adoptUser(userId, remote));
    return () => {
      alive = false;
    };
  }, [userId, adoptUser]);

  // Reminders follow the list: asked for only once there is a list, rescheduled when it changes.
  const tasks = useDay((s) => s.tasks);
  const notifyAt = useDay((s) => s.settings.notifyAt);
  useEffect(() => {
    if (!signedIn || !tasks.length) return;
    const id = setTimeout(() => void refreshReminders({ today: todayList(tasks), notifyAt }), 1200);
    return () => clearTimeout(id);
  }, [signedIn, tasks, notifyAt]);

  // Home-screen widget: mirror today's list, and apply ticks made on the widget when coming back.
  useEffect(() => {
    if (!signedIn) return;
    syncWidget({ today: todayList(tasks), seed: userId ?? 'getgo' });
  }, [signedIn, tasks, userId]);
  useEffect(() => {
    if (!signedIn) return;
    const apply = async () => {
      const changes = await widgetChanges();
      const { tasks: current, markDone, undoDone } = useDay.getState();
      for (const c of changes) {
        const task = current.find((x) => x.id === c.id);
        if (!task) continue;
        if (c.done && task.status === 'pendiente') markDone(task.id);
        if (!c.done && task.status === 'hecha') undoDone(task.id);
      }
    };
    void apply();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void apply());
    return () => sub.remove();
  }, [signedIn]);

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
          <Stack.Screen name="ahora" />
          <Stack.Screen name="no-puedo" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="hecho" options={{ gestureEnabled: false }} />
          <Stack.Screen name="racha" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cuenta" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="hablar" options={{ animation: 'none' }} />
          <Stack.Screen name="siguiente" options={{ animation: 'none' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
