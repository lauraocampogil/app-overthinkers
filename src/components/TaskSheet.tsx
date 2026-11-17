import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { addDays } from '@/lib/planner';
import type { Task } from '@/lib/types';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/** Bottom sheet with what you can do with one task: tick, today, tomorrow, rename, delete. */
export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { markDone, undoDone, moveTo, rename, remove } = useDay.getState();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? '');
    setEditing(false);
  }, [task]);

  if (!task) return null;
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
              <View>
                {task.status === 'hecha' ? (
                  <Option label={t('task.undo')} onPress={() => act(() => undoDone(task.id))} />
                ) : (
                  <Option label={t('task.markDone')} onPress={() => act(() => markDone(task.id))} strong />
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
      <Text style={[styles.optionText, strong && { color: colors.accentDark, fontFamily: fonts.semibold }, danger && { color: '#C2364B' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,26,61,0.35)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 10, gap: 14 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 6 },
  title: { fontSize: 24, lineHeight: 29 },
  option: { minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(31,26,61,0.06)' },
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
