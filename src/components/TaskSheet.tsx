import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minutesLabel, t } from '@/i18n';
import { estimate } from '@/lib/duraciones';
import { addDays } from '@/lib/planner';
import { requiresProof } from '@/lib/prioridad';
import type { Task } from '@/lib/types';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** Bottom sheet with what you can do with one task: tick, today, tomorrow, rename, delete. */
export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { markDone, undoDone, moveTo, rename, remove, setMinutes, toggleItem, addItem, setDetails, toggleTop, setNeedsProof } = useDay.getState();
  const learned = useDay((s) => s.learned);
  const goals = useDay((s) => s.goals);
  // Read the live task so checklist ticks show up while the sheet is open.
  const live = useDay((s) => (task ? s.tasks.find((x) => x.id === task.id) : undefined));
  const [item, setItem] = useState('');
  const [where, setWhere] = useState('');
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? '');
    setWhere(task?.where ?? '');
    setItem('');
    setEditing(false);
  }, [task]);

  if (!task) return null;
  const cur = live ?? task;
  const goal = cur.goalId ? goals.find((g) => g.id === cur.goalId) : undefined;
  const addOne = () => {
    const v = item.trim();
    if (v) addItem(cur.id, v);
    setItem('');
  };
  const saveWhere = () => {
    const v = where.trim();
    if (v !== (cur.where ?? '')) setDetails(cur.id, { where: v || undefined });
  };
  const today = todayIso();
  const tomorrow = addDays(today, 1);
  const act = (fn: () => void) => {
    fn();
    onClose();
  };
  const save = () => {
    const v = title.trim();
    if (v && v !== task.title) rename(task.id, v);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          {editing ? (
            <View style={{ gap: 12 }}>
              <TextInput
                accessibilityLabel={t('summary.taskName')}
                value={title}
                onChangeText={setTitle}
                autoFocus
                onSubmitEditing={save}
                returnKeyType="done"
                style={styles.input}
              />
              <Option label={t('task.save')} onPress={save} strong />
            </View>
          ) : (
            <>
              <Text style={[type.title, styles.title]} numberOfLines={3}>
                {task.title}
              </Text>
              {goal || cur.at ? (
                <Text style={styles.meta}>
                  {[goal ? t('sheet.goal', { title: goal.title }) : '', cur.at ? t('sheet.at', { time: cur.at }) : ''].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {cur.status === 'pendiente' ? (
                <TextInput
                  accessibilityLabel={t('sheet.where')}
                  value={where}
                  onChangeText={setWhere}
                  onEndEditing={saveWhere}
                  placeholder={t('sheet.wherePh')}
                  placeholderTextColor={colors.faint}
                  returnKeyType="done"
                  style={styles.field}
                />
              ) : null}
              {cur.status === 'pendiente' ? (
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>{t('proof.toggle')}</Text>
                    <Text style={styles.toggleSub}>{cur.proof ?? t('proof.anyPhoto')}</Text>
                  </View>
                  <Switch
                    value={Boolean(cur.needsProof)}
                    onValueChange={(on) => setNeedsProof(cur.id, on)}
                    trackColor={{ true: colors.ink, false: colors.line }}
                    accessibilityLabel={t('proof.toggle')}
                  />
                </View>
              ) : null}
              {cur.checklist.length || cur.status === 'pendiente' ? (
                <View style={{ gap: 6 }}>
                  {cur.checklist.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: c.done }}
                      onPress={() => toggleItem(cur.id, c.id)}
                      style={styles.item}
                    >
                      <View style={[styles.box, c.done && styles.boxOn]} />
                      <Text style={[styles.itemText, c.done && styles.itemDone]}>{c.text}</Text>
                    </Pressable>
                  ))}
                  {cur.status === 'pendiente' ? (
                    <TextInput
                      accessibilityLabel={t('sheet.addItem')}
                      value={item}
                      onChangeText={setItem}
                      onSubmitEditing={addOne}
                      blurOnSubmit={false}
                      placeholder={t('sheet.addItem')}
                      placeholderTextColor={colors.faint}
                      returnKeyType="done"
                      style={styles.field}
                    />
                  ) : null}
                </View>
              ) : null}
              {task.status === 'pendiente' ? (
                <View style={{ gap: 8 }}>
                  <Text style={type.muted}>
                    {(() => {
                      const est = estimate(task, learned);
                      if (est.source === 'stated') return t('dur.set', { time: minutesLabel(est.minutes) });
                      if (est.source === 'learned') return t('dur.learned', { time: minutesLabel(est.minutes) });
                      return t('dur.guess', { time: minutesLabel(est.minutes) });
                    })()}
                  </Text>
                  <View style={styles.chips}>
                    {DURATIONS.map((m) => {
                      const on = task.minutes === m;
                      return (
                        <Pressable
                          key={m}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => act(() => setMinutes(task.id, m))}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, on && { color: colors.white }]}>{minutesLabel(m)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View>
                {task.status === 'hecha' ? (
                  <Option label={t('task.undo')} onPress={() => act(() => undoDone(task.id))} />
                ) : (
                  <>
                    <Option
                      label={t('focus.start')}
                      onPress={() => act(() => router.push({ pathname: '/foco', params: { id: task.id } }))}
                      strong
                    />
                    {requiresProof(cur) ? (
                      <Option label={t('proof.take')} onPress={() => act(() => router.push({ pathname: '/prueba', params: { id: task.id } }))} />
                    ) : (
                      <Option label={t('task.markDone')} onPress={() => act(() => markDone(task.id))} />
                    )}
                    <Option label={cur.top ? t('top.unstar') : t('top.star')} onPress={() => act(() => toggleTop(task.id))} />
                  </>
                )}
                {task.status === 'pendiente' && task.day > today ? (
                  <Option label={t('task.doToday')} onPress={() => act(() => moveTo(task.id, today))} />
                ) : null}
                {task.status === 'pendiente' && task.day !== tomorrow ? (
                  <Option label={t('task.toTomorrow')} onPress={() => act(() => moveTo(task.id, tomorrow))} />
                ) : null}
                <Option label={t('task.rename')} onPress={() => setEditing(true)} />
                <Option label={t('task.delete')} onPress={() => act(() => remove(task.id))} danger last />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Option({ label, onPress, strong, danger, last }: { label: string; onPress: () => void; strong?: boolean; danger?: boolean; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.option, last && { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.optionText, strong && { color: colors.ink, fontFamily: fonts.semibold }, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const styles = StyleSheet.create({
  meta: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: -6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.soft },
  toggleTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  toggleSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  field: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.soft, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  itemText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  itemDone: { color: colors.muted, textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.soft, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.accentDark },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,10,0.4)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 10, gap: 14 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 6 },
  title: { fontSize: 24, lineHeight: 29 },
  option: { minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.soft,
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.ink,
  },
});
