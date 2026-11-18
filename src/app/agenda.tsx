import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ArrowRightIcon, CalendarIcon, MoonIcon, SunIcon } from '@/components/Iconos';
import { CloseIcon, IconCircle, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { connectCalendar, refreshAgenda, useAgenda } from '@/lib/calendario';
import { useVoz } from '@/lib/paleta';
import { routineOf } from '@/lib/rutinas';
import { todayIso, useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** Always HH:MM (24 h) so the list sorts and lines up: "06:00", not "6:00". */
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

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
  const routines = useDay((s) => s.routines);
  const settings = withDefaults(useDay((s) => s.settings));
  const voz = useVoz();

  useEffect(() => {
    void refreshAgenda(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: Item[] = [];
  for (const rk of ['manana', 'noche'] as const) {
    const r = routineOf(routines, rk);
    if (r.enabled && r.steps.length) items.push({ kind: 'routine', at: r.at, routine: rk, steps: r.steps.length });
  }
  for (const e of busy[day] ?? []) items.push({ kind: 'event', at: clock(e.start), end: clock(e.end), title: e.title });
  const dayTasks = tasks.filter((x) => x.status === 'pendiente' && x.day === day);
  for (const x of dayTasks) items.push({ kind: 'task', at: x.at ?? '', title: x.title, minutes: x.minutes, id: x.id, top: x.importance === 3 || !!x.top });
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
        {status !== 'on' ? (
          <Pressable onPress={() => void connect()} style={styles.connect} accessibilityRole="button">
            <CalendarIcon size={18} />
            <Text style={[styles.title, { flex: 1 }]}>{t('cal.connectTitle')}</Text>
            <ArrowRightIcon size={14} color={colors.faint} />
          </Pressable>
        ) : null}
        {items.length ? (
          items.map((it, i) => (
            <Animated.View key={`${it.kind}${i}`} entering={FadeInDown.delay(i * 40).duration(280)}>
              <Pressable
                disabled={it.kind === 'event'}
                onPress={() => (it.kind === 'routine' ? router.push({ pathname: '/rutina', params: { kind: it.routine } }) : undefined)}
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
            </Animated.View>
          ))
        ) : (
          <Text style={type.muted}>{t('day.nothing')}</Text>
        )}
      </ScrollView>
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
});
