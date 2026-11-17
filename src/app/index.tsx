import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Mascota } from '@/components/Mascota';
import { Ondas } from '@/components/Ondas';
import { CheckIcon, Dock, FlameIcon, IconCircle, PersonIcon, Screen } from '@/components/ui';
import { t, todayLabel } from '@/i18n';
import { useAtajos } from '@/lib/atajos';
import { useMascot } from '@/lib/auth';
import { isoDay } from '@/lib/streak';
import type { PlannedTask } from '@/lib/types';
import { useDay } from '@/store/day';
import { colors, fonts, gradients, type } from '@/theme';

/** What the mascot says, so the list always pushes towards finishing. */
function nudge(done: number, left: number, next?: string): { title: string; body: string } {
  if (left === 0) return { title: t('hoy.doneTitle'), body: t('hoy.doneBody') };
  const evening = new Date().getHours() >= 19;
  if (left === 1) return { title: t('hoy.lastOne'), body: t('hoy.lastOneBody', { title: next ?? '' }) };
  if (evening) return { title: t('hoy.evening'), body: t('hoy.left', { n: left }) };
  if (done === 0) return { title: t('hoy.left', { n: left }), body: t('hoy.startWith', { title: next ?? '' }) };
  return { title: t('hoy.going', { n: done }), body: t('hoy.left', { n: left }) };
}

function Check({ task, onToggle }: { task: PlannedTask; onToggle: () => void }) {
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
  const later = useDay((s) => s.later);
  const plan = useDay((s) => s.plan);
  const planDate = useDay((s) => s.planDate);
  const { markDone, undoDone } = useDay.getState();
  const mascot = useMascot();
  useAtajos();

  const active = planDate === isoDay(new Date()) ? plan.filter((x) => x.status !== 'quitada') : [];
  const pending = active.filter((x) => x.status === 'pendiente');
  const done = active.filter((x) => x.status === 'hecha');
  const current = pending[0];
  const rest = pending.slice(1);
  const hasList = active.length > 0;
  const allDone = hasList && pending.length === 0;
  const msg = nudge(done.length, pending.length, current?.title);
  const progress = hasList ? done.length / active.length : 0;
  const toggle = (task: PlannedTask) => (task.status === 'hecha' ? undoDone(task.id) : markDone(task.id));

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
    const waiting = later.slice(0, 2).map((x) => x.title.toLowerCase());
    const extra = later.length - waiting.length;
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
        {later.length > 0 ? (
          <Text style={styles.waiting}>
            {t('home.waiting', { list: waiting.join(' · ') })}
            {extra > 0 ? t('home.more', { n: extra }) : ''}
          </Text>
        ) : null}
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

        {current ? (
          <View style={styles.nowCard}>
            <View style={styles.nowTop}>
              <Text style={styles.nowLabel}>{t('hoy.now')}</Text>
              {current.minutes !== null ? <Text style={styles.meta}>{t('time.min', { n: current.minutes })}</Text> : null}
            </View>
            <View style={styles.nowRow}>
              <Check task={current} onToggle={() => toggle(current)} />
              <Text style={styles.nowTitle}>{current.title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/ahora')} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
              <LinearGradient colors={gradients.action} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startBtn}>
                <Text style={styles.startText}>{t('hoy.start')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {rest.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('hoy.next')}</Text>
            <View style={styles.list}>
              {rest.map((task, i) => (
                <View key={task.id} style={[styles.row, i === rest.length - 1 && styles.rowLast]}>
                  <Check task={task} onToggle={() => toggle(task)} />
                  <Text style={styles.rowTitle}>{task.title}</Text>
                  {task.importance === 3 ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{t('imp.3')}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {done.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('hoy.doneSection')}</Text>
            <View style={styles.list}>
              {done.map((task, i) => (
                <View key={task.id} style={[styles.row, i === done.length - 1 && styles.rowLast]}>
                  <Check task={task} onToggle={() => toggle(task)} />
                  <Text style={[styles.rowTitle, styles.rowDone]}>{task.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => router.push('/resumen')} style={styles.editLink} hitSlop={8}>
          <Text style={styles.editText}>{t('hoy.edit')}</Text>
        </Pressable>
      </ScrollView>
      {dock}
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

  editLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  editText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
});
