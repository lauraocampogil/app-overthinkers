import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Deslizar } from '@/components/Deslizar';
import { ArrowRightIcon, CalendarIcon, MoonIcon, SunIcon } from '@/components/Iconos';
import { CloseIcon, IconCircle, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { connectCalendar, dayTimeline, refreshAgenda, useAgenda } from '@/lib/calendario';
import { estimate } from '@/lib/duraciones';
import { useVoz } from '@/lib/paleta';
import { todayIso, useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** Always HH:MM (24 h) so the list sorts and lines up: "06:00", not "6:00". */
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** The hour ruler shown while dragging a task: 6:00 → 23:45. */
const FIRST = 6 * 60;
const LAST = 23 * 60 + 45;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type Drag = { id: string; title: string; minutes: number | null; y: number; at: number };

/**
 * A task without an hour: hold it and drag it up or down, the ruler on the left shows the hour it lands on.
 */
function Arrastrable({ id, title, minutes, onDrag, onDrop, children }: {
  id: string;
  title: string;
  minutes: number | null;
  onDrag: (d: Drag | null, y: number) => void;
  onDrop: (id: string, y: number) => void;
  children: React.ReactNode;
}) {
  const pan = usePanGesture({
    activateAfterLongPress: 320,
    runOnJS: true,
    onActivate: (e) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onDrag({ id, title, minutes, y: e.absoluteY, at: 0 }, e.absoluteY);
    },
    onUpdate: (e) => onDrag(null, e.absoluteY),
    onDeactivate: (e) => onDrop(id, e.absoluteY),
  });
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}

type Item =
  | { kind: 'routine'; at: string; routine: 'manana' | 'noche'; steps: number }
  | { kind: 'event'; at: string; end: string; title: string }
  | { kind: 'task'; at: string; title: string; minutes: number | null; id: string; top: boolean };

/**
 * One day at a glance, kept off Hoy so Hoy stays calm: the routines at their time, the events of every
 * calendar on the phone (iCloud, Google, Outlook…) and the tasks with an hour. Opened from the calendar
 * icon on Hoy, or by holding a day in the week strip.
 */
export default function Agenda() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIso();
  const status = useAgenda((s) => s.status);
  const busy = useAgenda((s) => s.busy);
  const tasks = useDay((s) => s.tasks);
  const learned = useDay((s) => s.learned);
  const settings = withDefaults(useDay((s) => s.settings));
  const voz = useVoz();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const store = useDay.getState;
  const [drag, setDrag] = useState<Drag | null>(null);
  const lastSlot = useRef(-1);

  // Ruler geometry: from below the header to above the home bar.
  const top = insets.top + 70;
  const bottom = height - insets.bottom - 30;
  const minuteAt = (y: number) => {
    const f = Math.min(1, Math.max(0, (y - top) / (bottom - top)));
    return Math.round((FIRST + f * (LAST - FIRST)) / 15) * 15;
  };
  const yOf = (m: number) => top + ((m - FIRST) / (LAST - FIRST)) * (bottom - top);

  const onDrag = (start: Drag | null, y: number) => {
    const at = minuteAt(y);
    if (at !== lastSlot.current) {
      lastSlot.current = at;
      void Haptics.selectionAsync().catch(() => {});
    }
    setDrag((cur) => (start ? { ...start, at } : cur ? { ...cur, y, at } : cur));
  };
  const onDrop = (id: string, y: number) => {
    const at = minuteAt(y);
    store().setDetails(id, { at: hhmm(at) });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDrag(null);
    lastSlot.current = -1;
  };

  useEffect(() => {
    void refreshAgenda(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: Item[] = [];
  // Routines wait for version 2 (product plan): not shown in the day either.
  for (const e of busy[day] ?? []) items.push({ kind: 'event', at: clock(e.start), end: clock(e.end), title: e.title });
  const dayTasks = tasks.filter((x) => x.status === 'pendiente' && x.day === day);
  const photos = tasks.filter((x) => x.status === 'hecha' && (x.doneOn ?? x.day) === day && x.proofPhoto);
  // Same hours as Hoy: tasks without a fixed hour get the slot Okio found for them in the free time.
  const timeline = status === 'on' ? dayTimeline(day, dayTasks, (x) => estimate(x, learned).minutes, settings) : null;
  const placedAt = (id: string) => {
    const b = timeline?.blocks.find((x) => x.type === 'task' && x.task.id === id);
    return b ? clock(b.start) : '';
  };
  for (const x of dayTasks) items.push({ kind: 'task', at: x.at ?? placedAt(x.id), title: x.title, minutes: x.minutes, id: x.id, top: x.importance === 3 || !!x.top });
  const mins = (at: string) => (at ? Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)) : 9999);
  items.sort((a, b) => mins(a.at) - mins(b.at));

  const connect = async () => {
    if (!(await connectCalendar())) return;
    const next = { ...settings, calendar: settings.calendar === 'off' ? ('read' as const) : settings.calendar };
    useDay.getState().setSettings({ calendar: next.calendar });
    await refreshAgenda(next);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[type.title, { textTransform: 'capitalize' }]} accessibilityRole="header">
          {day === todayIso() ? t('due.today') : new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {photos.map((x) => (
              <View key={x.id} style={styles.photoCard}>
                <Image source={{ uri: x.proofPhoto }} style={styles.photo} resizeMode="cover" />
                <Text style={styles.photoText} numberOfLines={1}>
                  {x.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {status !== 'on' ? (
          <Pressable onPress={() => void connect()} style={styles.connect} accessibilityRole="button">
            <CalendarIcon size={18} />
            <Text style={[styles.title, { flex: 1 }]}>{t('cal.connectTitle')}</Text>
            <ArrowRightIcon size={14} color={colors.faint} />
          </Pressable>
        ) : null}
        {items.length ? (
          items.map((it, i) => {
            const row = (
              <Pressable
                disabled={it.kind === 'event'}
                onPress={() => (it.kind === 'routine' ? router.push({ pathname: '/rutina', params: { kind: it.routine, d: day } }) : undefined)}
                style={styles.row}
              >
                <Text style={styles.time}>{it.at || '—'}</Text>
                {it.kind === 'task' && it.top ? (
                  <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.line} />
                ) : (
                  <View style={[styles.line, it.kind === 'event' && styles.lineEvent, it.kind === 'routine' && styles.lineRoutine]} />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {it.kind === 'routine' ? it.routine === 'manana' ? <SunIcon size={15} /> : <MoonIcon size={15} /> : null}
                    <Text style={styles.title} numberOfLines={2}>
                      {it.kind === 'routine' ? t(`routine.${it.routine}`) : it.title}
                    </Text>
                  </View>
                  <Text style={styles.meta}>
                    {it.kind === 'event'
                      ? `${it.at}–${it.end} · ${t('cal.event')}`
                      : it.kind === 'routine'
                        ? t('routine.stepsShort', { n: it.steps })
                        : it.minutes
                          ? minutesLabel(it.minutes)
                          : t('cal.task')}
                  </Text>
                </View>
                {it.kind === 'routine' ? <ArrowRightIcon size={14} color={colors.faint} /> : null}
              </Pressable>
            );
            return (
              <Animated.View key={it.kind === 'task' ? it.id : `${it.kind}${i}`} entering={FadeInDown.delay(i * 40).duration(280)} style={drag?.id === (it.kind === 'task' ? it.id : '') && { opacity: 0.25 }}>
                {it.kind === 'task' ? (
                  <Deslizar today={day} onMove={(d2) => store().moveTo(it.id, d2)} onDelete={() => store().remove(it.id)}>
                    <Arrastrable id={it.id} title={it.title} minutes={it.minutes} onDrag={onDrag} onDrop={onDrop}>
                      <View>{row}</View>
                    </Arrastrable>
                  </Deslizar>
                ) : (
                  row
                )}
              </Animated.View>
            );
          })
        ) : (
          <Text style={type.muted}>{t('day.nothing')}</Text>
        )}
        {items.some((it) => it.kind === 'task') ? <Text style={styles.hint}>{t('agenda.dragHint')}</Text> : null}
      </ScrollView>
      {drag ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
          <Text style={[styles.dragTitle, { top: insets.top + 18 }]}>{t('agenda.dropTitle')}</Text>
          {Array.from({ length: 18 }, (_, k) => FIRST + k * 60).map((m) => (
            <View key={m} style={[styles.tick, { top: yOf(m) - 8 }]}>
              <Text style={styles.tickText}>{hhmm(m)}</Text>
              <View style={styles.tickLine} />
            </View>
          ))}
          {/* What already has an hour that day, in light grey, so the free gaps are easy to see. */}
          {items
            .filter((it) => it.at && !(it.kind === 'task' && it.id === drag.id))
            .map((it, k) => {
              const m = Number(it.at.slice(0, 2)) * 60 + Number(it.at.slice(3, 5));
              if (m < FIRST || m > LAST) return null;
              const len = it.kind === 'event' ? Math.max(15, Number(it.end.slice(0, 2)) * 60 + Number(it.end.slice(3, 5)) - m) : it.kind === 'task' ? (it.minutes ?? 30) : 20;
              return (
                <View key={`b${k}`} style={[styles.busy, { top: yOf(m), height: Math.max(18, (len / (LAST - FIRST)) * (bottom - top)) }]}>
                  <Text style={styles.busyText} numberOfLines={1}>
                    {it.kind === 'routine' ? t(`routine.${it.routine}`) : it.title}
                  </Text>
                </View>
              );
            })}
          {/* The slot the task would take, as tall as its duration. */}
          <View style={[styles.slot, { top: yOf(drag.at), height: Math.max(20, ((drag.minutes ?? 30) / (LAST - FIRST)) * (bottom - top)) }]}>
            <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          </View>
          <View style={[styles.ghost, { top: drag.y - 30 }]}>
            <Text style={styles.ghostTime}>{hhmm(drag.at)}{drag.minutes ? `–${hhmm(Math.min(1439, drag.at + drag.minutes))}` : ''}</Text>
            <Text style={styles.title} numberOfLines={1}>{drag.title}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, height: 52, justifyContent: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 6 },
  connect: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.card, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62 },
  time: { width: 50, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  line: { width: 4, alignSelf: 'stretch', marginVertical: 8, borderRadius: 2, backgroundColor: colors.ink },
  lineEvent: { backgroundColor: colors.faint },
  lineRoutine: { backgroundColor: colors.line },
  title: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, flexShrink: 1 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  dragTitle: { position: 'absolute', left: 20, right: 20, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  photos: { gap: 10, paddingVertical: 8 },
  photoCard: { width: 120, gap: 6 },
  photo: { width: 120, height: 150, borderRadius: 18, backgroundColor: colors.card },
  photoText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 12 },
  // Fully covers the list underneath: while dragging, only the hours and the day's plan are visible.
  overlay: { backgroundColor: colors.bg },
  busy: { position: 'absolute', left: 92, right: 20, borderRadius: 10, backgroundColor: colors.card, paddingHorizontal: 10, justifyContent: 'center' },
  busyText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  tick: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tickText: { width: 50, fontFamily: fonts.medium, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  tickLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  slot: { position: 'absolute', left: 80, width: 4, borderRadius: 2, overflow: 'hidden' },
  ghost: {
    position: 'absolute',
    left: 92,
    right: 20,
    minHeight: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  ghostTime: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
});
