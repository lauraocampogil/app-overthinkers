import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, useFonts } from '@expo-google-fonts/geist';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { SplashAnimado } from '@/components/SplashAnimado';
import { unblockAll } from '@/lib/bloqueo';
import { useFoco } from '@/lib/foco';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { identifyUser, initMonitoring, initPurchases } from '@/lib/monitor';

void SplashScreen.preventAutoHideAsync().catch(() => {});
initMonitoring();
initPurchases();
import { clearTaskReminders, refreshReminders, snoozeTask, type TaskAlarm } from '@/lib/avisos';
import { dayTimeline, refreshAgenda, useAgenda } from '@/lib/calendario';
import { estimate } from '@/lib/duraciones';
import { requiresProof, topThree } from '@/lib/prioridad';
import { routineOf } from '@/lib/rutinas';
import { syncWidget, widgetChanges } from '@/lib/widget';
import { pullDay } from '@/lib/sync';
import { todayIso, todayList, useDay, withDefaults } from '@/store/day';

export default function RootLayout() {
  const [loaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
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
  useEffect(() => identifyUser(userId), [userId]);

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
  const rawSettings = useDay((s) => s.settings);
  const routines = useDay((s) => s.routines);
  const agendaLoaded = useAgenda((s) => s.loadedAt);
  useEffect(() => {
    if (!signedIn || !tasks.length) return;
    const id = setTimeout(() => {
      const settings = withDefaults(rawSettings);
      const { learned } = useDay.getState();
      const day = todayIso();
      const today = todayList(tasks);
      const pending = today.filter((x) => x.status === 'pendiente');
      const minutesOf = (x: (typeof tasks)[number]) => estimate(x, learned).minutes;
      const timeline = useAgenda.getState().status === 'on' ? dayTimeline(day, pending, minutesOf, settings) : null;
      const top = topThree(today, day, useDay.getState().profile.areas).map((x) => x.id);
      const at = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
      };
      // When each task should start nagging: its calendar slot, its fixed time, or (top 3 without time) late morning.
      const alarms: TaskAlarm[] = pending.flatMap((task) => {
        const b = timeline?.blocks.find((x) => x.type === 'task' && x.task.id === task.id);
        if (b) return [{ task, start: b.start }];
        if (task.at) return [{ task, start: at(task.at) }];
        const i = top.indexOf(task.id);
        if (i >= 0) return [{ task, start: at(['10:00', '12:00', '15:00'][i]) }];
        return [];
      });
      void refreshReminders({
        today,
        alarms,
        notifyAt: settings.notifyAt,
        dayEnd: settings.dayEnd,
        routines: { manana: routineOf(routines, 'manana'), noche: routineOf(routines, 'noche') },
      });
    }, 1200);
    return () => clearTimeout(id);
  }, [signedIn, tasks, rawSettings, routines, agendaLoaded]);

  // Tapping a reminder: "Hecho" opens the task (camera if it needs proof); "15 min" snoozes it.
  useEffect(() => {
    if (!signedIn) return;
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as { taskId?: string; url?: string } | undefined;
      const task = data?.taskId ? useDay.getState().tasks.find((x) => x.id === data.taskId) : undefined;
      if (res.actionIdentifier === 'snooze' && task) {
        void snoozeTask(task);
        return;
      }
      if (task && task.status === 'pendiente') {
        if (requiresProof(task)) router.push({ pathname: '/prueba', params: { id: task.id } });
        else router.push({ pathname: '/foco', params: { id: task.id } });
        return;
      }
      const url = data?.url ?? '';
      const kind = /rutina\?kind=(manana|noche)/.exec(url)?.[1];
      if (kind) router.push({ pathname: '/rutina', params: { kind } });
    });
    return () => sub.remove();
  }, [signedIn]);

  // A task that gets done: its reminders go away immediately.
  useEffect(
    () =>
      useDay.subscribe((s, prev) => {
        const before = new Map(prev.tasks.map((x) => [x.id, x.status]));
        for (const x of s.tasks) if (x.status === 'hecha' && before.get(x.id) === 'pendiente') void clearTaskReminders(x.id);
      }),
    [],
  );

  // Home-screen widget: mirror today's list, and apply ticks made on the widget when coming back.
  useEffect(() => {
    if (!signedIn) return;
    const st = useDay.getState();
    syncWidget({ today: todayList(tasks), seed: userId ?? 'getgo', day: todayIso(), areas: st.profile.areas, streak: st.streak.current, focus: st.focusLog?.[todayIso()] ?? 0 });
  }, [signedIn, tasks, userId]);
  useEffect(() => {
    if (!signedIn) return;
    const apply = async () => {
      const changes = await widgetChanges();
      const { tasks: current, markDone, undoDone } = useDay.getState();
      for (const c of changes) {
        const task = current.find((x) => x.id === c.id);
        if (!task) continue;
        // A task that needs a photo can't be ticked from the widget: it stays open until proven in the app.
        if (c.done && task.status === 'pendiente' && !requiresProof(task)) markDone(task.id);
        if (!c.done && task.status === 'hecha') undoDone(task.id);
      }
    };
    void apply();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void apply());
    return () => sub.remove();
  }, [signedIn]);

  // Calendar: re-read events when the app opens or comes back, then re-plan around them.
  const calendarMode = useDay((s) => withDefaults(s.settings).calendar);
  useEffect(() => {
    if (!signedIn || calendarMode === 'off') return;
    const run = async () => {
      await refreshAgenda(withDefaults(useDay.getState().settings));
      useDay.getState().replan();
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    return () => sub.remove();
  }, [signedIn, calendarMode]);

  // The native splash stays until the animated one is on screen; that one hides it and plays its intro.
  const [intro, setIntro] = useState(true);
  // If the app was closed in the middle of a focus session, its apps may still be blocked: lift them unless one still runs.
  useEffect(() => {
    if (!useFoco.getState().session) unblockAll();
  }, []);

  if (!loaded || !ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'fade' }}>
        {/* An account is required: without a session only the sign-in screen exists. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="metas" options={{ animation: 'none' }} />
          <Stack.Screen name="progreso" options={{ animation: 'none' }} />
          <Stack.Screen name="dia" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="escuchando" options={{ gestureEnabled: false }} />
          <Stack.Screen name="escribir" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ordenando" options={{ gestureEnabled: false }} />
          <Stack.Screen name="ahora" />
          <Stack.Screen name="foco" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="prueba" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="rutina" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="rutinas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="bienvenida" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="compra" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="meta" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="semana" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="agenda" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="bloqueo" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
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
      {intro ? <SplashAnimado onDone={() => setIntro(false)} /> : null}
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
