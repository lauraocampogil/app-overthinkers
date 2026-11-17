import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/components/Anillo';
import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { Pestanas } from '@/components/Pestanas';
import { TaskSheet } from '@/components/TaskSheet';
import { CheckIcon, Dock, FlameIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { useAtajos } from '@/lib/atajos';
import { useMascot } from '@/lib/auth';
import { connectCalendar, dayTimeline, defaultCalendarId, refreshAgenda, useAgenda } from '@/lib/calendario';
import { estimate } from '@/lib/duraciones';
import { daysBetween } from '@/lib/planner';
import type { Goal, Task } from '@/lib/types';
import { todayIso, todayList, useDay, withDefaults } from '@/store/day';
import { colors, fonts, gradients, type } from '@/theme';

const COLUMN = 214;
const DOTS = ['#F49AC9', '#8A5CFF', '#FFB997', '#5FD3C6', '#C77DFF'];
const KIND_DOT: Record<string, string> = { trabajo: '#8A5CFF', estudio: '#C77DFF', deporte: '#F49AC9', casa: '#FFB997', otro: '#B9AEE8' };

/** Colour dot of a task: its goal's colour, or its kind. */
export function dotColor(task: Task, goals: Goal[]) {
  const i = task.goalId ? goals.findIndex((g) => g.id === task.goalId) : -1;
  return i >= 0 ? DOTS[i % DOTS.length] : KIND_DOT[task.kind] ?? '#B9AEE8';
}

const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

function columnLabel(day: string) {
  const diff = daysBetween(todayIso(), day);
  if (diff === 1) return t('hoy.tomorrow');
  return new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

/** What the mascot says, so the list always pushes towards finishing. */
function nudge(done: number, total: number, left: number) {
  if (!total) return t('hoy.freeToday');
  if (left === 0) return t('hoy.doneTitle');
  return t('hoy.progressTitle', { done, total });
}

function Check({ task, onToggle, size = 24 }: { task: Task; onToggle: () => void; size?: number }) {
  const on = task.status === 'hecha';
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={task.title} onPress={onToggle} hitSlop={10}>
      {on ? (
        <LinearGradient colors={gradients.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.checkCenter, box]}>
          <CheckIcon color={colors.white} size={size * 0.55} />
        </LinearGradient>
      ) : (
        <View style={[styles.checkOff, box]} />
      )}
    </Pressable>
  );
}

type Slot = { start: Date; end: Date } | null;

export default function Inicio() {
  const streak = useDay((s) => s.streak);
  const tasks = useDay((s) => s.tasks);
  const goals = useDay((s) => s.goals);
  const learned = useDay((s) => s.learned);
  const settings = withDefaults(useDay((s) => s.settings));
  const { markDone, undoDone, toggleItem } = useDay.getState();
  const agenda = useAgenda((s) => s.status);
  useAgenda((s) => s.loadedAt); // re-render when the calendar is re-read
  const mascot = useMascot();
  useAtajos();
  const [sheet, setSheet] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);

  const minutesOf = (task: Task) => estimate(task, learned).minutes;
  const durLabel = (task: Task) => {
    const e = estimate(task, learned);
    return `${e.source === 'guess' ? '~' : ''}${minutesLabel(e.minutes)}`;
  };
  const toggle = (task: Task) => (task.status === 'hecha' ? undoDone(task.id) : markDone(task.id));

  // Connecting the calendar = GetGo plans with hours and puts the tasks in it automatically.
  const connect = async () => {
    if (!(await connectCalendar())) return;
    const target = settings.calendarTarget ?? (await defaultCalendarId());
    useDay.getState().setSettings({ calendar: 'write', calendarTarget: target });
    await refreshAgenda({ ...settings, calendar: 'write', calendarTarget: target });
    useDay.getState().replan();
  };

  // Confirmation after adding ("4 tareas añadidas · 1 meta").
  const params = useLocalSearchParams<{ added?: string; today?: string; later?: string; goals?: string }>();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const n = Number(params.added);
    if (!n) return;
    const parts = [t('hoy.added', { n })];
    if (Number(params.goals)) parts.push(t('hoy.addedGoals', { n: Number(params.goals) }));
    else if (Number(params.later)) parts.push(t('hoy.addedSplit', { today: Number(params.today), later: Number(params.later) }));
    setToast(parts.join(' · '));
    const id = setTimeout(() => setToast(null), 3500);
    router.setParams({ added: undefined, today: undefined, later: undefined, goals: undefined });
    return () => clearTimeout(id);
  }, [params.added, params.today, params.later, params.goals]);

  const today = todayIso();
  const active = todayList(tasks);
  const pending = active.filter((x) => x.status === 'pendiente');
  const done = active.filter((x) => x.status === 'hecha');

  // With the calendar: hours for today. Without: GetGo's order.
  const timeline = agenda === 'on' ? dayTimeline(today, pending, minutesOf, settings) : null;
  const placedToday = timeline ? timeline.blocks.flatMap((b) => (b.type === 'task' ? [b.task] : [])) : pending;
  const orderedToday = timeline ? [...placedToday, ...timeline.overflow] : pending;
  const slot = (task: Task): Slot => {
    const b = timeline?.blocks.find((x) => x.type === 'task' && x.task.id === task.id);
    return b ? { start: b.start, end: b.end } : null;
  };
  const current = orderedToday[0];
  const next = orderedToday[1];
  const nowSlot = current ? slot(current) : null;

  // Pipeline columns: today, then each of the next 6 days that has something, then "later".
  const future = tasks.filter((x) => x.status === 'pendiente' && x.day > today);
  const near = [...new Set(future.map((x) => x.day))].sort().filter((d) => daysBetween(today, d) <= 6);
  const later = future.filter((x) => daysBetween(today, x.day) > 6);
  const dayCards = (day: string): { task: Task; slot: Slot }[] => {
    const list = future.filter((x) => x.day === day);
    if (agenda !== 'on') return list.map((task) => ({ task, slot: null }));
    const tl = dayTimeline(day, list, minutesOf, settings);
    return [
      ...tl.blocks.flatMap((b) => (b.type === 'task' ? [{ task: b.task, slot: { start: b.start, end: b.end } }] : [])),
      ...tl.overflow.map((task) => ({ task, slot: null })),
    ];
  };

  const header = (
    <View style={styles.header}>
      <Pestanas active="hoy" />
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
    <View style={styles.dock} pointerEvents="box-none">
      <Dock onWrite={() => router.push('/escribir')} onSpeak={() => router.push('/escuchando')} />
    </View>
  );

  // Nothing yet: the brain-dump invitation.
  if (!tasks.some((x) => x.status === 'pendiente' || x.doneOn === today) && !goals.some((g) => !g.archived)) {
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

  const card = (task: Task, s: Slot) => {
    const goal = goals.find((g) => g.id === task.goalId);
    const doneItems = task.checklist.filter((i) => i.done).length;
    const meta = task.where ? `📍 ${task.where}` : goal ? goal.title : '';
    return (
      <Pressable
        key={task.id}
        onPress={() => setSheet(task)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        accessibilityHint={t('task.options')}
      >
        <View style={styles.cardTop}>
          <View style={[styles.dot, { backgroundColor: dotColor(task, goals) }]} />
          <Text style={styles.cardTime} numberOfLines={1}>
            {s ? `${clock(s.start)} – ${clock(s.end)}` : task.at ?? durLabel(task)}
          </Text>
          <Check task={task} onToggle={() => toggle(task)} size={22} />
        </View>
        <Text style={[styles.cardTitle, task.status === 'hecha' && styles.done]} numberOfLines={2}>
          {task.title}
        </Text>
        {meta || task.checklist.length ? (
          <View style={styles.cardMeta}>
            <Text style={styles.metaText} numberOfLines={1}>
              {meta}
            </Text>
            {task.checklist.length ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {doneItems}/{task.checklist.length}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const restToday = orderedToday.filter((x) => x.id !== current?.id);
  const todayEvents = timeline ? timeline.blocks.filter((b) => b.type === 'event') : [];

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Progress ring with the mascot (or the halo during the first week). */}
        <View style={styles.hero}>
          <Anillo progress={active.length ? done.length / active.length : 0} size={104} stroke={8}>
            {mascot.unlocked ? (
              <Mascota seed={mascot.seed} size={92} mood={active.length && !pending.length ? 'feliz' : 'calma'} />
            ) : (
              <LinearGradient colors={gradients.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.halo} />
            )}
          </Anillo>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {nudge(done.length, active.length, pending.length)}
            </Text>
            <Text style={type.muted} numberOfLines={2}>
              {current
                ? next
                  ? t('hoy.nextUp', { title: next.title, time: slot(next) ? clock(slot(next)!.start) : durLabel(next) })
                  : t('hoy.lastOneBody', { title: current.title })
                : active.length
                  ? t('hoy.doneBody')
                  : t('hoy.freeTodayBody')}
            </Text>
          </View>
        </View>

        {current ? (
          <View style={styles.nowCard}>
            <View style={styles.nowTop}>
              <Text style={styles.nowLabel} numberOfLines={1}>
                {t('hoy.now').toUpperCase()}
                {nowSlot ? ` · ${clock(nowSlot.start)} – ${clock(nowSlot.end)}` : ''}
              </Text>
              <Text style={styles.metaText}>{durLabel(current)}</Text>
            </View>
            <Pressable style={styles.nowRow} onPress={() => setSheet(current)} accessibilityHint={t('task.options')}>
              <Check task={current} onToggle={() => toggle(current)} size={26} />
              <Text style={styles.nowTitle}>{current.title}</Text>
            </Pressable>
            {current.where ? <Text style={styles.metaText}>📍 {current.where}</Text> : null}
            {current.checklist.length ? (
              <View style={styles.chips}>
                {current.checklist.map((i) => (
                  <Pressable
                    key={i.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: i.done }}
                    onPress={() => toggleItem(current.id, i.id)}
                    style={[styles.chip, i.done && styles.chipDone]}
                  >
                    <Text style={[styles.chipText, i.done && styles.chipTextDone]}>{i.text}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => router.push('/ahora')} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
              <LinearGradient colors={gradients.action} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startBtn}>
                <Text style={styles.startText}>{t('hoy.start')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Pipeline: one column per day, swipe sideways. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COLUMN + 12}
          decelerationRate="fast"
          contentContainerStyle={styles.pipeline}
          style={styles.pipelineWrap}
        >
          <View style={styles.column}>
            <View style={styles.colHead}>
              <Text style={styles.colTitle}>{t('tab.today')}</Text>
              <Text style={styles.colCount}>{restToday.length}</Text>
            </View>
            {timeline
              ? timeline.blocks.map((b, i) =>
                  b.type === 'event' ? (
                    <View key={`e${i}`} style={styles.event}>
                      <Text style={styles.cardTime}>
                        {clock(b.start)} – {clock(b.end)}
                      </Text>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {b.title}
                      </Text>
                    </View>
                  ) : b.task.id === current?.id ? null : (
                    card(b.task, { start: b.start, end: b.end })
                  ),
                )
              : restToday.map((task) => card(task, null))}
            {timeline && timeline.overflow.filter((x) => x.id !== current?.id).length ? (
              <>
                <Text style={styles.colNote}>{t('cal.noRoom')}</Text>
                {timeline.overflow.filter((x) => x.id !== current?.id).map((task) => card(task, null))}
              </>
            ) : null}
            {!restToday.length && !todayEvents.length ? <Text style={styles.colNote}>{t('hoy.colEmpty')}</Text> : null}
            {done.length ? (
              <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle} accessibilityRole="button">
                <Text style={styles.colNote}>{t('hoy.doneCount', { n: done.length })}</Text>
              </Pressable>
            ) : null}
            {showDone ? done.map((task) => card(task, null)) : null}
          </View>

          {near.map((day) => {
            const list = dayCards(day);
            return (
              <View key={day} style={styles.column}>
                <View style={styles.colHead}>
                  <Text style={[styles.colTitle, styles.capital]}>{columnLabel(day)}</Text>
                  <Text style={styles.colCount}>{list.length}</Text>
                </View>
                {list.map(({ task, slot: s }) => card(task, s))}
              </View>
            );
          })}

          {later.length ? (
            <View style={styles.column}>
              <View style={styles.colHead}>
                <Text style={styles.colTitle}>{t('hoy.later')}</Text>
                <Text style={styles.colCount}>{later.length}</Text>
              </View>
              {later.map((task) => card(task, null))}
            </View>
          ) : null}
        </ScrollView>

        {agenda !== 'on' ? (
          <Pressable accessibilityRole="button" onPress={() => void connect()} style={styles.connect}>
            <Text style={styles.connectTitle}>{t(agenda === 'denied' ? 'cal.deniedTitle' : 'cal.connectTitle')}</Text>
            <Text style={type.muted}>{t(agenda === 'denied' ? 'cal.deniedBody' : 'cal.connectBodyAuto')}</Text>
            <Text style={styles.connectCta}>{t('cal.connect')}</Text>
          </Pressable>
        ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52, marginTop: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.white },
  pillText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  titleBlock: { paddingHorizontal: 24, marginTop: 28, gap: 10 },
  center: { flex: 1, justifyContent: 'center' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 28 },

  body: { paddingTop: 8, paddingBottom: 140, gap: 18 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  halo: { width: 74, height: 74, borderRadius: 37, opacity: 0.9 },
  heroTitle: { fontFamily: fonts.medium, fontSize: 26, lineHeight: 30, letterSpacing: -0.7, color: colors.ink },

  nowCard: { marginHorizontal: 20, backgroundColor: colors.white, borderRadius: 28, padding: 18, gap: 12 },
  nowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  nowLabel: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.3, color: colors.accentDark },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.soft, justifyContent: 'center' },
  chipDone: { backgroundColor: '#EFE9FA' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentDark },
  chipTextDone: { color: colors.faint, textDecorationLine: 'line-through' },
  startBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  startText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },

  pipelineWrap: { flexGrow: 0 },
  pipeline: { paddingHorizontal: 20, gap: 12, alignItems: 'flex-start' },
  column: { width: COLUMN, gap: 8 },
  colHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 6, minHeight: 22 },
  colTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  colCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  colNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingHorizontal: 6 },
  capital: { textTransform: 'capitalize' },
  doneToggle: { minHeight: 36, justifyContent: 'center' },

  card: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTime: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  cardTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.ink },
  done: { color: colors.faint, textDecorationLine: 'line-through' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  badge: { paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: colors.soft, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.accentDark },
  event: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  eventTitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  checkCenter: { alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 2, borderColor: '#D9CCF5', backgroundColor: colors.white },

  connect: { marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 24, padding: 18, gap: 6 },
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
