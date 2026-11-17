import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { TaskSheet } from '@/components/TaskSheet';
import { CheckIcon, Dock, FlameIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, minutesLabel, t, todayLabel } from '@/i18n';
import { connectCalendar, refreshAgenda, todayTimeline, useAgenda } from '@/lib/calendario';
import { estimate } from '@/lib/duraciones';
import { useAtajos } from '@/lib/atajos';
import { useMascot } from '@/lib/auth';
import { daysBetween } from '@/lib/planner';
import type { Task } from '@/lib/types';
import { todayIso, todayList, upcoming, useDay, withDefaults } from '@/store/day';
import { colors, fonts, gradients, type } from '@/theme';

/** "Mañana", "jueves 20 nov" or, past a week, "Más adelante". */
function dayLabel(day: string): string {
  const diff = daysBetween(todayIso(), day);
  if (diff === 1) return t('hoy.tomorrow');
  if (diff > 7) return t('hoy.later');
  return new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Deadline tag on a task: "hoy", "mañana" or "jue 20". */
function dueLabel(due: string | null): string | null {
  if (!due) return null;
  const diff = daysBetween(todayIso(), due);
  if (diff <= 0) return t('due.today');
  if (diff === 1) return t('due.tomorrow');
  return new Date(`${due}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

/** What the mascot says, so the list always pushes towards finishing. */
function nudge(done: number, left: number, next?: string): { title: string; body: string } {
  if (left === 0) return { title: t('hoy.doneTitle'), body: t('hoy.doneBody') };
  const evening = new Date().getHours() >= 19;
  if (left === 1) return { title: t('hoy.lastOne'), body: t('hoy.lastOneBody', { title: next ?? '' }) };
  if (evening) return { title: t('hoy.evening'), body: t('hoy.left', { n: left }) };
  if (done === 0) return { title: t('hoy.left', { n: left }), body: t('hoy.startWith', { title: next ?? '' }) };
  return { title: t('hoy.going', { n: done }), body: t('hoy.left', { n: left }) };
}

function Check({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const on = task.status === 'hecha';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={task.title}
      onPress={onToggle}
      hitSlop={10}
    >
      {on ? (
        <LinearGradient colors={gradients.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.check}>
          <CheckIcon color={colors.white} size={14} />
        </LinearGradient>
      ) : (
        <View style={[styles.check, styles.checkOff]} />
      )}
    </Pressable>
  );
}

export default function Inicio() {
  const streak = useDay((s) => s.streak);
  const tasks = useDay((s) => s.tasks);
  const learned = useDay((s) => s.learned);
  const settings = withDefaults(useDay((s) => s.settings));
  const agenda = useAgenda((s) => s.status);
  useAgenda((s) => s.loadedAt); // re-render when the calendar is re-read
  const est = (task: Task) => estimate(task, learned);
  const durLabel = (task: Task) => {
    const e = est(task);
    return `${e.source === 'guess' ? '~' : ''}${minutesLabel(e.minutes)}`;
  };
  const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const connect = async () => {
    if (!(await connectCalendar())) return;
    useDay.getState().setSettings({ calendar: 'read' });
    await refreshAgenda({ ...settings, calendar: 'read' });
    useDay.getState().replan();
  };
  const { markDone, undoDone } = useDay.getState();
  const mascot = useMascot();
  useAtajos();
  const [sheet, setSheet] = useState<Task | null>(null);

  // Confirmation after adding tasks ("4 añadidas · 2 hoy, 2 más adelante"), shown for a few seconds.
  const params = useLocalSearchParams<{ added?: string; today?: string; later?: string }>();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const n = Number(params.added);
    if (!n) return;
    const msgText = [t('hoy.added', { n }), Number(params.later) ? t('hoy.addedSplit', { today: Number(params.today), later: Number(params.later) }) : '']
      .filter(Boolean)
      .join(' · ');
    setToast(msgText);
    const id = setTimeout(() => setToast(null), 3500);
    router.setParams({ added: undefined, today: undefined, later: undefined });
    return () => clearTimeout(id);
  }, [params.added, params.today, params.later]);

  const active = todayList(tasks);
  const pending = active.filter((x) => x.status === 'pendiente');
  const done = active.filter((x) => x.status === 'hecha');
  const next = upcoming(tasks);
  const current = pending[0];
  const rest = pending.slice(1);
  const hasList = active.length > 0 || next.length > 0;
  const allDone = active.length > 0 && pending.length === 0;
  const msg = active.length ? nudge(done.length, pending.length, current?.title) : { title: t('hoy.freeToday'), body: t('hoy.freeTodayBody') };
  const progress = active.length ? done.length / active.length : 0;
  // With the calendar: today's pending tasks placed in your free time, with hours.
  const timeline = agenda === 'on' ? todayTimeline(pending, (x) => est(x).minutes, settings) : null;
  const slotOf = (task: Task) => {
    const b = timeline?.blocks.find((x) => x.type === 'task' && x.task.id === task.id);
    return b ? `${clock(b.start)} – ${clock(b.end)}` : null;
  };
  const toggle = (task: Task) => (task.status === 'hecha' ? undoDone(task.id) : markDone(task.id));
  // Several upcoming days past a week fold into one "Más adelante" group.
  const groups: [string, Task[]][] = [];
  for (const [day, list] of next) {
    const label = dayLabel(day);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(...list);
    else groups.push([label, [...list]]);
  }
  const row = (task: Task, i: number, all: Task[]) => {
    const due = task.status === 'pendiente' ? dueLabel(task.due) : null;
    return (
      <Pressable
        key={task.id}
        onPress={() => setSheet(task)}
        accessibilityHint={t('task.options')}
        style={[styles.row, i === all.length - 1 && styles.rowLast]}
      >
        <Check task={task} onToggle={() => toggle(task)} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.rowTitle, task.status === 'hecha' && styles.rowDone]}>{task.title}</Text>
          {task.status === 'pendiente' ? <Text style={styles.rowMeta}>{durLabel(task)}</Text> : null}
        </View>
        {due ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{due}</Text>
          </View>
        ) : task.importance === 3 && task.status === 'pendiente' ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{t('imp.3')}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.date}>{todayLabel()}</Text>
      <View style={styles.headerRight}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('streak.open')}: ${t('home.streak', { n: streak.current })}`}
          onPress={() => router.push('/racha')}
          style={styles.pill}
          hitSlop={6}
        >
          <FlameIcon />
          <Text style={styles.pillText}>{t('home.streak', { n: streak.current })}</Text>
        </Pressable>
        <IconCircle label={t('account.title')} onPress={() => router.push('/cuenta')} size={34}>
          <PersonIcon />
        </IconCircle>
      </View>
    </View>
  );

  const dock = (
    <View style={styles.dock}>
      <Dock onWrite={() => router.push('/escribir')} onSpeak={() => router.push('/escuchando')} />
    </View>
  );

  // No list yet today: the brain-dump invitation, as before.
  if (!hasList) {
    return (
      <Screen>
        {header}
        <View style={styles.titleBlock}>
          <Text style={type.title} accessibilityRole="header">
            {t('home.title')}
          </Text>
          <Text style={type.muted}>{t('home.subtitle')}</Text>
        </View>
        <View style={styles.center}>
          {mascot.unlocked ? <Mascota seed={mascot.seed} size={250} /> : <Ondas mode="calma" height={300} />}
        </View>
        {dock}
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {mascot.unlocked ? (
            <Mascota seed={mascot.seed} size={allDone ? 190 : 130} mood={allDone ? 'feliz' : 'calma'} />
          ) : (
            <Ondas mode={allDone ? 'hecho' : 'calma'} height={allDone ? 200 : 130} />
          )}
          <View style={styles.msg} accessibilityLiveRegion="polite">
            <Text style={[type.title, styles.msgTitle]} accessibilityRole="header">
              {msg.title}
            </Text>
            <Text style={[type.muted, { textAlign: 'center' }]}>{msg.body}</Text>
          </View>
        </View>

        {active.length > 0 ? (
        <View style={styles.progressRow} accessibilityLabel={t('hoy.progress', { done: done.length, total: active.length })}>
          <View style={styles.track}>
            <LinearGradient
              colors={gradients.mic}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${Math.max(progress * 100, progress ? 6 : 0)}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{t('hoy.progress', { done: done.length, total: active.length })}</Text>
        </View>
        ) : null}

        {current ? (
          <View style={styles.nowCard}>
            <View style={styles.nowTop}>
              <Text style={styles.nowLabel}>{t('hoy.now')}</Text>
              <Text style={styles.meta}>{slotOf(current) ?? durLabel(current)}</Text>
            </View>
            <Pressable style={styles.nowRow} onPress={() => setSheet(current)} accessibilityHint={t('task.options')}>
              <Check task={current} onToggle={() => toggle(current)} />
              <Text style={styles.nowTitle}>{current.title}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/ahora')} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
              <LinearGradient colors={gradients.action} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startBtn}>
                <Text style={styles.startText}>{t('hoy.start')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {timeline ? (
          <>
            {timeline.blocks.some((b) => b.type === 'event' || b.task.id !== current?.id) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('hoy.todayRest')}</Text>
                <View style={styles.list}>
                  {timeline.blocks
                    .filter((b) => b.type === 'event' || b.task.id !== current?.id)
                    .map((b, i, all) => (
                      <View key={b.type === 'task' ? b.task.id : `e${i}`} style={[styles.timeRow, i === all.length - 1 && styles.rowLast]}>
                        <Text style={styles.timeCol}>{clock(b.start)}</Text>
                        {b.type === 'task' ? (
                          <Pressable style={styles.timeBody} onPress={() => setSheet(b.task)} accessibilityHint={t('task.options')}>
                            <Check task={b.task} onToggle={() => toggle(b.task)} />
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={styles.rowTitle}>{b.task.title}</Text>
                              <Text style={styles.rowMeta}>{durLabel(b.task)}</Text>
                            </View>
                          </Pressable>
                        ) : (
                          <View style={styles.timeBody}>
                            <View style={styles.eventDot} />
                            <Text style={styles.eventTitle} numberOfLines={1}>
                              {b.title}
                            </Text>
                            <Text style={styles.rowMeta}>{clock(b.end)}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                </View>
              </View>
            ) : null}
            {timeline.overflow.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('cal.noRoom')}</Text>
                <View style={styles.list}>{timeline.overflow.map((task, i, all) => row(task, i, all))}</View>
              </View>
            ) : null}
            {done.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('hoy.doneSection')}</Text>
                <View style={styles.list}>{done.map((task, i, all) => row(task, i, all))}</View>
              </View>
            ) : null}
          </>
        ) : rest.length > 0 || done.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('hoy.todayRest')}</Text>
            <View style={styles.list}>{[...rest, ...done].map((task, i, all) => row(task, i, all))}</View>
          </View>
        ) : null}

        {agenda !== 'on' ? (
          <Pressable accessibilityRole="button" onPress={() => void connect()} style={styles.connect}>
            <Text style={styles.connectTitle}>{t(agenda === 'denied' ? 'cal.deniedTitle' : 'cal.connectTitle')}</Text>
            <Text style={type.muted}>{t(agenda === 'denied' ? 'cal.deniedBody' : 'cal.connectBody')}</Text>
            <Text style={styles.connectCta}>{t('cal.connect')}</Text>
          </Pressable>
        ) : null}

        {groups.map(([label, list]) => (
          <View key={label} style={styles.section}>
            <Text style={[styles.sectionTitle, styles.capital]}>{label}</Text>
            <View style={styles.list}>{list.map((task, i, all) => row(task, i, all))}</View>
          </View>
        ))}
      </ScrollView>
      {toast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <CheckIcon color={colors.white} size={16} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      {dock}
      <TaskSheet task={sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 44, marginTop: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.white },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  titleBlock: { paddingHorizontal: 24, marginTop: 32, gap: 10 },
  center: { flex: 1, justifyContent: 'center' },
  waiting: { ...type.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginBottom: 18 },
  dock: { paddingBottom: 12 },

  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  hero: { alignItems: 'center', gap: 6, marginTop: 4 },
  msg: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  msgTitle: { fontSize: 28, lineHeight: 32, textAlign: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  progressText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },

  nowCard: { backgroundColor: colors.white, borderRadius: 28, padding: 18, gap: 14 },
  nowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nowLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentDark, letterSpacing: 0.2 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: colors.ink },
  startBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  startText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },

  section: { gap: 8 },
  sectionTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, paddingHorizontal: 6 },
  list: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 24, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: 'rgba(31,26,61,0.06)' },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  rowDone: { color: colors.faint, textDecorationLine: 'line-through' },
  tag: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.soft, justifyContent: 'center' },
  tagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.accentDark },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 2, borderColor: '#D9CCF5', backgroundColor: colors.white },

  capital: { textTransform: 'capitalize' },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: 'rgba(31,26,61,0.06)' },
  timeCol: { width: 46, fontFamily: fonts.medium, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  timeBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 8, backgroundColor: '#C9BEE8' },
  eventTitle: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  connect: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 24, padding: 18, gap: 6 },
  connectTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  connectCta: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accentDark, marginTop: 6 },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
  },
  toastText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.white },
});
