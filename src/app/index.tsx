import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Anillo } from '@/components/Anillo';
import { ArrowRightIcon, CalendarIcon, CameraIcon, ChartIcon, ClockIcon, StarIcon, MoonIcon, PinIcon, PlayIcon, SunIcon, TargetIcon } from '@/components/Iconos';
import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { Barra } from '@/components/Barra';
import { Celebracion } from '@/components/Celebracion';
import { Deslizar } from '@/components/Deslizar';
import { TaskSheet } from '@/components/TaskSheet';
import { CheckIcon, FlameIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { useAtajos } from '@/lib/atajos';
import { useAuth, useMascot } from '@/lib/auth';
import { dayTimeline, useAgenda } from '@/lib/calendario';
import { estimate } from '@/lib/duraciones';
import { useVoz } from '@/lib/paleta';
import { addDays, daysBetween } from '@/lib/planner';
import { requiresProof, topThree } from '@/lib/prioridad';
import { routineNow, routineOf } from '@/lib/rutinas';
import { checkinDue, isWeightGoal, nextReto, RETOS } from '@/lib/retos';
import { keepPhoto } from '@/lib/fotos';
import type { Goal, Task } from '@/lib/types';
import { retoText, todayIso, todayList, useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** Monochrome: goals get shades of grey (kept for other screens that import it). */
const DOTS = ['#0A0A0A', '#5C5C5C', '#9A9A9A', '#2E2E2E', '#BDBDBD'];
export function dotColor(task: Task, goals: Goal[]) {
  const i = task.goalId ? goals.findIndex((g) => g.id === task.goalId) : -1;
  return i >= 0 ? DOTS[i % DOTS.length] : '#BDBDBD';
}

const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long' });

/** Tick. A task that needs a photo shows a camera and opens the proof screen instead. */
function Check({ task, onToggle, size = 24, onDark = false }: { task: Task; onToggle: () => void; size?: number; onDark?: boolean }) {
  const on = task.status === 'hecha';
  const proof = requiresProof(task);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={task.title}
      accessibilityHint={proof ? t('proof.hint') : undefined}
      onPress={proof ? () => router.push({ pathname: '/prueba', params: { id: task.id } }) : onToggle}
      hitSlop={10}
    >
      {on ? (
        <View style={[styles.center, box, { backgroundColor: onDark ? colors.white : colors.ink }]}>
          <CheckIcon color={onDark ? colors.ink : colors.white} size={size * 0.55} />
        </View>
      ) : (
        <View style={[styles.center, box, styles.checkOff, onDark && styles.checkOffDark]}>
          {proof ? <CameraIcon color={onDark ? '#BDBDBD' : colors.muted} size={size * 0.56} strokeWidth={1.7} /> : null}
        </View>
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
  const routines = useDay((s) => s.routines);
  const routineLog = useDay((s) => s.routineLog);
  const weekPlannedOn = useDay((s) => s.weekPlannedOn);
  const areas = useDay((s) => s.profile.areas);
  const onboarded = useDay((s) => s.profile.onboarded);
  const owner = useDay((s) => s.owner);
  const settings = withDefaults(useDay((s) => s.settings));
  const { markDone, undoDone, toggleItem, moveTo, toggleRoutineStep } = useDay.getState();
  const userId = useAuth((s) => s.session?.user.id ?? null);
  const agenda = useAgenda((s) => s.status);
  useAgenda((s) => s.loadedAt);
  const mascot = useMascot();
  const voz = useVoz();
  useAtajos();
  const [sheet, setSheet] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const retos = useDay((s) => s.retos);
  const [weight, setWeight] = useState('');
  const [sel, setSel] = useState(todayIso());
  const nudges = useDay((s) => s.nudges);
  const [celebrate, setCelebrate] = useState(false);
  const focused = useIsFocused();
  // The moment the last task of today is ticked (not when opening an already finished day): celebrate once.
  const todayAll = todayList(tasks);
  const leftToday = todayAll.filter((x) => x.status === 'pendiente').length;
  const prevLeft = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevLeft.current;
    prevLeft.current = leftToday;
    if (prev && prev > 0 && leftToday === 0 && todayAll.length > 0 && useDay.getState().nudges.doneOn !== todayIso()) {
      useDay.getState().setNudge({ doneOn: todayIso() });
      setCelebrate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftToday]);

  const minutesOf = (task: Task) => estimate(task, learned).minutes;
  const durLabel = (task: Task) => {
    const e = estimate(task, learned);
    // Only a duration the person gave (or GetGo learned from them): never show an invented one.
    return e.source === 'guess' ? '' : minutesLabel(e.minutes);
  };
  const toggle = (task: Task) => (task.status === 'hecha' ? undoDone(task.id) : markDone(task.id));


  const params = useLocalSearchParams<{ added?: string; today?: string; later?: string; goals?: string }>();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const n = Number(params.added);
    if (!n) return;
    const parts = [t('hoy.added', { n })];
    if (Number(params.goals)) parts.push(t('hoy.addedGoals', { n: Number(params.goals) }));
    else if (Number(params.later)) parts.push(t('hoy.addedSplit', { today: Number(params.today), later: Number(params.later) }));
    setToast(parts.join(' · '));
    router.setParams({ added: undefined, today: undefined, later: undefined, goals: undefined });
  }, [params.added, params.today, params.later, params.goals]);
  // Its own timer: clearing the params above re-runs that effect, which used to cancel the hide.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // One challenge on offer at a time, matched to the person's areas and goals.
  useEffect(() => {
    if (!onboarded || retos.some((r) => r.status === 'offered')) return;
    const next = nextReto(areas.map((a) => a.id), goals, retos, todayIso());
    if (next) useDay.getState().offerReto(next.id, next.goalId);
  }, [onboarded, retos, areas, goals]);

  if (userId && owner !== userId) return <Screen>{null}</Screen>;
  if (!onboarded) return <Redirect href="/bienvenida" />;

  const today = todayIso();
  const active = todayList(tasks);
  const pending = active.filter((x) => x.status === 'pendiente');
  const done = active.filter((x) => x.status === 'hecha');
  const timeline = agenda === 'on' ? dayTimeline(today, pending, minutesOf, settings) : null;
  const slot = (task: Task): Slot => {
    const b = timeline?.blocks.find((x) => x.type === 'task' && x.task.id === task.id);
    return b ? { start: b.start, end: b.end } : null;
  };
  const timeOf = (task: Task) => (slot(task) ? clock(slot(task)!.start) : task.at ?? '');

  const top = topThree(active, today, areas);
  const topDone = done.filter((x) => x.top);
  const topRows = [...topDone, ...top].slice(0, 3);
  const current = top[0];
  const ordered = timeline ? [...timeline.blocks.flatMap((b) => (b.type === 'task' ? [b.task] : [])), ...timeline.overflow] : pending;
  const rest = ordered.filter((x) => !topRows.some((y) => y.id === x.id));


  // The goal that ends soonest, as a countdown next to the streak.
  const nextGoal = goals
    .filter((g) => !g.archived && g.due && g.due >= today)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))[0];
  const daysLeft = nextGoal?.due ? daysBetween(today, nextGoal.due) : null;

  const offer = retos.find((r) => r.status === 'offered');
  const checkinGoal = checkinDue(goals, today);
  const checkin = checkinGoal && !(checkinGoal.checkins ?? []).some((c) => c.date === today) ? checkinGoal : null;
  const kind = routineNow();
  const routine = kind ? routineOf(routines, kind) : null;
  const routineDone = kind ? (routineLog[today]?.[kind] ?? []).length : 0;

  const header = (
    <View style={styles.header}>
      <Text style={styles.screenTitle} accessibilityRole="header">{t('tab.today')}</Text>
      <View style={styles.headerRight}>
        {daysLeft !== null ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${nextGoal!.title}: ${t('goals.daysLeft', { n: daysLeft })}`} onPress={() => router.push({ pathname: '/meta', params: { id: nextGoal!.id } })} style={styles.pill} hitSlop={6}>
            <TargetIcon size={14} />
            <Text style={styles.pillText}>{t('goals.daysShort', { n: daysLeft })}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('streak.open')}: ${t('home.streak', { n: streak.current })}`} onPress={() => router.push('/racha')} style={styles.pill} hitSlop={6}>
          <FlameIcon />
          <Text style={styles.pillText}>{streak.current}</Text>
        </Pressable>
        <IconCircle label={t('account.title')} onPress={() => router.push('/cuenta')} size={34}>
          <PersonIcon />
        </IconCircle>
      </View>
    </View>
  );
  const dow = new Date(`${today}T12:00:00`).getDay();
  // Sunday or Monday, and the week has not been planned in the last days.
  const showPlanWeek = (dow === 0 || dow === 1) && (!weekPlannedOn || daysBetween(weekPlannedOn, today) > 2);
  const dock = <Barra active="hoy" />;

  if (!tasks.some((x) => x.status === 'pendiente' || x.doneOn === today) && !goals.some((g) => !g.archived)) {
    return (
      <Screen tabs>
        {header}
        <View style={styles.titleBlock}>
          <Text style={type.title} accessibilityRole="header">{t('home.title')}</Text>
          <Text style={type.muted}>{t('home.subtitle')}</Text>
        </View>
        <Pressable onPress={() => router.push('/semana')} style={({ pressed }) => [styles.planWeek, { marginHorizontal: 20, marginTop: 16 }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <CalendarIcon size={20} color={colors.white} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.planWeekTitle}>{t('week.cardTitle')}</Text>
            <Text style={styles.planWeekBody}>{t('week.cardBody')}</Text>
          </View>
          <ArrowRightIcon size={18} color={colors.white} />
        </Pressable>
        <View style={styles.flexCenter}>{mascot.unlocked ? <Mascota seed={mascot.seed} size={250} /> : <Ondas mode="calma" height={300} />}</View>
        {dock}
      </Screen>
    );
  }

  const row = (task: Task) => (
    <Pressable key={task.id} onPress={() => setSheet(task)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityHint={t('task.options')}>
      <Check task={task} onToggle={() => toggle(task)} size={24} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, task.status === 'hecha' && styles.done]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[timeOf(task), durLabel(task), task.where ?? ''].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );

  // The next 7 days as a calm strip: tap a day to see only what that day holds.
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const countOn = (day: string) => (day === today ? pending.length : tasks.filter((x) => x.status === 'pendiente' && x.day === day).length);
  const strip = (
    <View style={styles.strip} accessibilityRole="tablist">
      {days.map((day) => {
        const on = day === sel;
        const date = new Date(`${day}T12:00:00`);
        return (
          <Pressable
            key={day}
            onPress={() => setSel(day)}
            style={[styles.stripDay, on && styles.stripDayOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' })}: ${countOn(day)}`}
          >
            <Text style={[styles.stripName, on && { color: '#BDBDBD' }]}>{date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)}</Text>
            <Text style={[styles.stripNum, on && { color: colors.white }]}>{date.getDate()}</Text>
            <View style={[styles.stripDot, { opacity: countOn(day) ? 1 : 0 }, on && { backgroundColor: colors.white }]} />
          </Pressable>
        );
      })}
    </View>
  );

  const selTasks = tasks.filter((x) => x.day === sel && x.status === 'pendiente').sort((a, b) => (a.at ?? '99').localeCompare(b.at ?? '99'));
  const dayView = (
    <View style={styles.section}>
      <Text style={styles.dayTitle} accessibilityRole="header">
        {new Date(`${sel}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <Text style={[styles.rowMeta, { marginBottom: 10 }]}>{selTasks.length ? t('day.count', { n: selTasks.length }) : t('day.nothing')}</Text>
      {(['manana', 'noche'] as const).map((rk) => {
        const r = routineOf(routines, rk);
        return r.enabled && r.steps.length ? (
          <Pressable key={rk} onPress={() => router.push({ pathname: '/rutina', params: { kind: rk } })} style={styles.dayRoutineRow} accessibilityRole="button">
            {rk === 'manana' ? <SunIcon size={16} color={colors.muted} /> : <MoonIcon size={16} color={colors.muted} />}
            <Text style={[styles.rowMeta, { flex: 1 }]}>
              {t(`routine.${rk}`)} · {r.at} · {t('routine.stepsShort', { n: r.steps.length })}
            </Text>
            <ArrowRightIcon size={14} color={colors.faint} />
          </Pressable>
        ) : null;
      })}
      {selTasks.map((task) => (
        <Deslizar key={task.id} today={today} onMove={(d) => moveTo(task.id, d)}>
          {row(task)}
        </Deslizar>
      ))}
      {!selTasks.length ? (
        <Pressable onPress={() => router.push('/semana')} style={styles.dayPlan} accessibilityRole="button">
          <CalendarIcon size={18} />
          <Text style={[styles.routineTitle, { flex: 1 }]}>{t('week.cardTitle')}</Text>
          <ArrowRightIcon size={16} />
        </Pressable>
      ) : null}
    </View>
  );

  // Weekly check-in and the day's challenge come as one calm pop-up, not as cards that stay on screen.
  const popupKind = nudges.laterOn === today ? null : checkin ? 'checkin' : offer ? 'reto' : null;
  const snooze = () => useDay.getState().setNudge({ laterOn: today });
  const popup = (
    <Modal visible={!!popupKind && !sheet && !celebrate && focused} transparent animationType="fade" onRequestClose={snooze}>
      <Pressable style={styles.popBack} onPress={snooze} accessibilityLabel={t('popup.later')} />
      <View style={styles.popCard}>
        {popupKind === 'checkin' && checkin ? (
          <>
            <View style={styles.offerHead}>
              <ChartIcon size={18} />
              <Text style={styles.label}>{t('checkin.label').toUpperCase()}</Text>
            </View>
            <Text style={styles.popTitle}>{isWeightGoal(checkin) ? t('checkin.weightTitle') : t('checkin.photoTitle')}</Text>
            <Text style={styles.rowMeta}>{checkin.title}</Text>
            {isWeightGoal(checkin) ? (
              <View style={styles.weightRow}>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="62,5"
                  placeholderTextColor={colors.faint}
                  style={styles.weightInput}
                  accessibilityLabel={t('checkin.weightTitle')}
                />
                <Text style={styles.unit}>kg</Text>
                <Pressable
                  onPress={() => {
                    const v = Number(weight.replace(',', '.'));
                    if (v > 20 && v < 400) useDay.getState().addCheckin(checkin.id, { value: v });
                    setWeight('');
                  }}
                  style={styles.offerYes}
                  accessibilityRole="button"
                >
                  <Text style={styles.offerYesText}>{t('task.save')}</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              onPress={async () => {
                const uri = await keepPhoto(`progress-${checkin.id}-${today}`);
                if (uri) useDay.getState().addCheckin(checkin.id, { photo: uri });
              }}
              style={styles.offerPhoto}
              accessibilityRole="button"
            >
              <CameraIcon size={18} />
              <Text style={styles.offerNoText}>{t('checkin.photo')}</Text>
            </Pressable>
          </>
        ) : null}
        {popupKind === 'reto' && offer ? (
          <>
            <View style={styles.offerHead}>
              <StarIcon size={16} />
              <Text style={styles.label}>{t('reto.label').toUpperCase()}</Text>
            </View>
            <Text style={styles.popTitle}>{retoText(offer.id, offer.n)}</Text>
            <Text style={styles.rowMeta}>
              {offer.goalId ? t('reto.forGoal', { goal: goals.find((g) => g.id === offer.goalId)?.title ?? '' }) : t('reto.body')} · {t(`routine.${RETOS[offer.id].routine}`)}
            </Text>
            <View style={styles.offerBtns}>
              <Pressable onPress={() => useDay.getState().answerReto(offer.id, true)} style={styles.offerYes} accessibilityRole="button">
                <Text style={styles.offerYesText}>{t('reto.accept')}</Text>
              </Pressable>
              <Pressable onPress={() => useDay.getState().answerReto(offer.id, false)} style={styles.offerNo} accessibilityRole="button">
                <Text style={styles.offerNoText}>{t('reto.decline')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <Pressable onPress={snooze} style={styles.popLater} accessibilityRole="button">
          <Text style={styles.popLaterText}>{t('popup.later')}</Text>
        </Pressable>
      </View>
    </Modal>
  );

  return (
    <Screen tabs>
      {header}
      {strip}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {sel !== today ? dayView : (<>
        <View style={styles.hero}>
          <Anillo progress={active.length ? done.length / active.length : 0} size={84} stroke={6} color={voz.mic[1]}>
            {mascot.unlocked ? (
              <Mascota seed={mascot.seed} size={74} mood={active.length && !pending.length ? 'feliz' : 'calma'} />
            ) : (
              <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.halo} />
            )}
          </Anillo>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              {!active.length ? t('hoy.freeToday') : !pending.length ? t('hoy.doneTitle') : t('hoy.progressTitle', { done: done.length, total: active.length })}
            </Text>
            <Text style={type.muted} numberOfLines={2}>
              {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {showPlanWeek ? (
          <Pressable onPress={() => router.push('/semana')} style={({ pressed }) => [styles.planWeek, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <CalendarIcon size={20} color={colors.white} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.planWeekTitle}>{t('week.cardTitle')}</Text>
              <Text style={styles.planWeekBody}>{t('week.cardBody')}</Text>
            </View>
            <ArrowRightIcon size={18} color={colors.white} />
          </Pressable>
        ) : null}

        {routine && routine.enabled && routine.steps.length && kind ? (
          routineDone >= routine.steps.length ? (
            <Pressable onPress={() => router.push({ pathname: '/rutina', params: { kind } })} style={styles.routineDone} accessibilityRole="button">
              {kind === 'manana' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
              <Text style={[styles.rowMeta, { flex: 1 }]}>{t('routine.doneLine', { name: t(`routine.${kind}`) })}</Text>
              <CheckIcon color={colors.ink} size={16} />
            </Pressable>
          ) : (
            <View style={styles.routine}>
              <Pressable onPress={() => router.push({ pathname: '/rutina', params: { kind } })} style={styles.routineHead} accessibilityRole="button">
                {kind === 'manana' ? <SunIcon /> : <MoonIcon />}
                <Text style={[styles.routineTitle, { flex: 1 }]}>{t(`routine.${kind}`)}</Text>
                <Text style={styles.routineCount}>
                  {routineDone}/{routine.steps.length}
                </Text>
                <ArrowRightIcon size={14} color={colors.faint} />
              </Pressable>
              <View style={styles.routineBar}>
                <View style={[styles.routineFill, { width: `${(routineDone / routine.steps.length) * 100}%`, backgroundColor: voz.mic[1] }]} />
              </View>
              {routine.steps.map((step) => {
                const on = (routineLog[today]?.[kind] ?? []).includes(step.id);
                return (
                  <Pressable key={step.id} onPress={() => toggleRoutineStep(kind, step.id)} style={styles.routineStep} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <View style={[styles.center, styles.routineBox, on && styles.routineBoxOn]}>{on ? <CheckIcon color={colors.white} size={12} /> : null}</View>
                    <Text style={[styles.routineStepText, on && styles.done]}>{step.text}</Text>
                    <Text style={styles.rowMeta}>{minutesLabel(step.minutes)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )
        ) : null}

        {topRows.length ? (
          <View style={styles.topCard}>
            <View style={styles.topHead}>
              <Text style={styles.label}>{t('top.title').toUpperCase()}</Text>
              <Text style={styles.topCount}>
                {topDone.length}/{topRows.length}
              </Text>
            </View>
            {topRows.map((task, i) => (
              <Pressable key={task.id} onPress={() => setSheet(task)} style={styles.topRow} accessibilityHint={t('task.options')}>
                <Text style={[styles.topNum, task.status === 'hecha' && { color: '#5E5E5E' }]}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.topTitle, task.status === 'hecha' && styles.doneDark]} numberOfLines={2}>
                    {task.title}
                  </Text>
                  {timeOf(task) || task.where ? (
                    <Text style={styles.topMeta} numberOfLines={1}>
                      {[timeOf(task), task.where ?? ''].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Check task={task} onToggle={() => toggle(task)} size={28} onDark />
              </Pressable>
            ))}
            {current ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('focus.start')}: ${current.title}`}
                onPress={() => router.push({ pathname: '/foco', params: { id: current.id } })}
                style={({ pressed }) => [styles.focusBtn, pressed && { transform: [{ scale: 0.98 }] }]}
              >
                <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.focusPlay}>
                  <PlayIcon size={16} />
                </LinearGradient>
                <Text style={styles.focusText} numberOfLines={1}>
                  {t('focus.start')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {rest.length || done.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('hoy.restToday')}</Text>
              <Text style={styles.sectionCount}>{rest.length}</Text>
            </View>
            {rest.map((task) => (
              <Deslizar key={task.id} today={today} onMove={(d) => moveTo(task.id, d)}>
                {row(task)}
              </Deslizar>
            ))}
            {rest.length ? <Text style={styles.swipeHint}>{t('swipe.hint')}</Text> : null}
            {done.filter((x) => !x.top).length ? (
              <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle} accessibilityRole="button" accessibilityState={{ expanded: showDone }}>
                <Text style={styles.rowMeta}>{t('hoy.doneCount', { n: done.filter((x) => !x.top).length })}</Text>
              </Pressable>
            ) : null}
            {showDone ? done.filter((x) => !x.top).map(row) : null}
          </View>
        ) : null}

        {/* Both routines are always here: open them, or set them up if they are still empty. */}
        <View style={styles.section}>
          {(['manana', 'noche'] as const).map((rk) => {
            const r = routineOf(routines, rk);
            if (rk === kind && r.enabled && r.steps.length) return null; // shown above while it runs
            const ready = r.enabled && r.steps.length > 0;
            const n = (routineLog[today]?.[rk] ?? []).length;
            return (
              <Pressable
                key={rk}
                onPress={() => router.push(ready ? { pathname: '/rutina', params: { kind: rk } } : '/rutinas')}
                style={styles.routineLine}
                accessibilityRole="button"
              >
                {rk === 'manana' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.routineTitle}>{t(`routine.${rk}`)}</Text>
                  <Text style={styles.rowMeta}>
                    {ready ? `${r.at} · ${t('routine.stepsShort', { n: r.steps.length })}` : t('routine.setUp')}
                  </Text>
                </View>
                {ready ? n >= r.steps.length ? <CheckIcon color={colors.ink} size={16} /> : <Text style={styles.rowMeta}>{n}/{r.steps.length}</Text> : null}
                <ArrowRightIcon size={14} color={colors.faint} />
              </Pressable>
            );
          })}
        </View>
        </>)}
      </ScrollView>

      {toast ? (
        <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(260)} style={styles.toast} accessibilityLiveRegion="polite">
          <CheckIcon color={colors.white} size={16} />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
      {dock}
      <TaskSheet task={sheet} onClose={() => setSheet(null)} />
      {popup}
      <Celebracion visible={celebrate && focused} done={done.length} streak={streak.current} onClose={() => setCelebrate(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  stripDay: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 18 },
  stripDayOn: { backgroundColor: colors.ink },
  stripName: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
  stripNum: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
  stripDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink, marginTop: 2 },
  dayTitle: { fontFamily: fonts.semibold, fontSize: 24, letterSpacing: -0.7, color: colors.ink, textTransform: 'capitalize', marginTop: 8 },
  routineLine: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  dayRoutineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  dayPlan: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.card, marginTop: 14 },
  focusBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 8, marginTop: 6, marginBottom: 8, borderRadius: 28, backgroundColor: '#1E1E1E' },
  focusPlay: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  focusText: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
  popBack: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  popCard: { position: 'absolute', left: 12, right: 12, bottom: 28, padding: 22, borderRadius: 30, backgroundColor: colors.white, gap: 6 },
  popTitle: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: colors.ink, marginTop: 4 },
  popLater: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  popLaterText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  planWeek: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, backgroundColor: colors.ink },
  planWeekTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white, letterSpacing: -0.2 },
  planWeekBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#BDBDBD' },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52, marginTop: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 11, borderRadius: 17, backgroundColor: colors.card },
  pillText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  screenTitle: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1.1, color: colors.ink },
  titleBlock: { paddingHorizontal: 24, marginTop: 28, gap: 10 },
  flexCenter: { flex: 1, justifyContent: 'center' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 28 },
  body: { paddingTop: 10, paddingBottom: 150, gap: 14 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginBottom: 4 },
  halo: { width: 60, height: 60, borderRadius: 30, opacity: 0.9 },
  heroTitle: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.9, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.7, color: colors.muted },

  routine: { marginHorizontal: 20, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.line, gap: 6 },
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  routineCount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  routineBar: { height: 3, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden', marginVertical: 6 },
  routineFill: { height: 3, borderRadius: 2 },
  routineStep: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  routineBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint },
  routineBoxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  routineStepText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  routineDone: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 44, borderRadius: 22, backgroundColor: colors.card },
  offer: { marginHorizontal: 20, padding: 18, borderRadius: 24, backgroundColor: colors.card, gap: 6 },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerTitle: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 23, letterSpacing: -0.4, color: colors.ink, marginTop: 4 },
  offerBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  offerYes: { minHeight: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  offerYesText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.white },
  offerNo: { minHeight: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  offerNoText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  offerPhoto: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.card, marginTop: 8 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  weightInput: { width: 110, minHeight: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.card, fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
  unit: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted, flex: 1 },
  swipeHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginTop: 6 },
  dayRoutine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayRoutineText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  topCard: { marginHorizontal: 20, backgroundColor: colors.ink, borderRadius: 28, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  topHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  topCount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A2A2A' },
  topNum: { width: 22, fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.6, color: colors.white },
  topTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 21, color: colors.white },
  topMeta: { fontFamily: fonts.regular, fontSize: 13, color: '#8A8A8A' },
  doneDark: { color: '#5E5E5E', textDecorationLine: 'line-through' },

  now: { marginHorizontal: 20, backgroundColor: colors.card, borderRadius: 28, padding: 18, gap: 10 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nowTitle: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 25, letterSpacing: -0.5, color: colors.ink },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  playWrap: { borderRadius: 32, overflow: 'hidden' },
  play: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.white, justifyContent: 'center' },
  chipDone: { backgroundColor: colors.soft },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },

  section: { marginHorizontal: 20, gap: 2, marginTop: 6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  sectionCount: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 20, color: colors.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  done: { color: colors.faint, textDecorationLine: 'line-through' },
  doneToggle: { minHeight: 44, justifyContent: 'center' },
  checkOff: { borderWidth: 1.5, borderColor: colors.faint, backgroundColor: colors.white },
  checkOffDark: { backgroundColor: 'transparent', borderColor: '#5E5E5E' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dayCard: { width: '48.4%', minHeight: 132, backgroundColor: colors.card, borderRadius: 22, padding: 14, gap: 8 },
  dayCardNext: { backgroundColor: colors.ink },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dayName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textTransform: 'capitalize' },
  dayCount: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  dayTask: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dayDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint, marginTop: 3 },
  dayTaskText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.ink },
  dayEmpty: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint },

  connect: { marginHorizontal: 20, borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 18, gap: 6 },
  connectCta: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 6, textDecorationLine: 'underline' },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 112, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, minHeight: 48, borderRadius: 24, backgroundColor: colors.ink },
  toastText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.white },
});
