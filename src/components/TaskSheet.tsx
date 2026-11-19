import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, CartIcon, ClockIcon, GearIcon, PinIcon, PlayIcon, TargetIcon, TrashIcon } from '@/components/Iconos';
import { PrimerPaso } from '@/components/PrimerPaso';
import { CheckIcon, CloseIcon } from '@/components/ui';
import { locale, minutesLabel, t } from '@/i18n';
import { appsFor, openApp } from '@/lib/apps';
import { estimate } from '@/lib/duraciones';
import { useVoz } from '@/lib/paleta';
import { addDays } from '@/lib/planner';
import { requiresProof } from '@/lib/prioridad';
import { isShopping } from '@/lib/compra';
import { leaveAt, travelTo } from '@/lib/trayecto';
import type { Task } from '@/lib/types';
import { todayIso, useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const DURATIONS = [15, 30, 45, 60, 90, 120];

/**
 * One task, one decision: the big button starts the focus session. The photo closes it.
 * Everything else (place, duration, priority, tomorrow, rename, delete) waits behind the gear.
 */
export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { undoDone, moveTo, rename, remove, setMinutes, toggleItem, setDetails, toggleTop, setNeedsProof, markDone } = useDay.getState();
  const learned = useDay((s) => s.learned);
  const goals = useDay((s) => s.goals);
  const live = useDay((s) => (task ? s.tasks.find((x) => x.id === task.id) : undefined));
  const insets = useSafeAreaInsets();
  const voz = useVoz();
  const [settings, setSettings] = useState(false);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [editPlace, setEditPlace] = useState(false);
  const [where, setWhere] = useState('');

  useEffect(() => {
    setSettings(false);
    setTitle(task?.title ?? '');
    setWhere(task?.where ?? '');
  }, [task?.id]);

  if (!task) return null;
  const cur = live ?? task;
  const goal = cur.goalId ? goals.find((g) => g.id === cur.goalId) : undefined;
  const est = estimate(cur, learned);
  const today = todayIso();
  const go = (fn: () => void) => {
    onClose();
    setTimeout(fn, 50);
  };
  const shopping = isShopping(cur);
  const { home, transport } = useDay.getState().profile;
  const travel = travelTo(cur.where, home, transport);
  const proof = requiresProof(cur);
  // One of the top 3: a photo is offered (never required) when it is ticked. Commitment, not control.
  const offerProof = !proof && cur.top && withDefaults(useDay.getState().settings).proofTop;
  const dayLabel =
    cur.day === today ? t('due.today') : cur.day === addDays(today, 1) ? t('due.tomorrow') : new Date(`${cur.day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long' });

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
          <View style={styles.top}>
            <Pressable onPress={() => setSettings((v) => !v)} accessibilityRole="button" accessibilityLabel={t('sheet.settings')} style={[styles.round, settings && styles.roundOn]} hitSlop={6}>
              <GearIcon color={settings ? colors.white : colors.ink} size={18} />
            </Pressable>
            <View style={styles.grabber} />
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.round} hitSlop={6}>
              <CloseIcon />
            </Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[type.title, styles.title, cur.status === 'hecha' && styles.done]} numberOfLines={3}>
              {cur.title}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.meta}>
                <ClockIcon color={colors.muted} size={14} />
                <Text style={styles.metaText}>
                  {dayLabel}
                  {cur.at ? ` · ${cur.at}` : ''}
                  {est.source === 'guess' ? '' : ` · ${minutesLabel(est.minutes)}`}
                </Text>
              </View>
              {cur.where && !editPlace ? (
                <Pressable style={styles.meta} onPress={() => { setPlace(cur.where ?? ''); setEditPlace(true); }} accessibilityRole="button" accessibilityHint={t('task.placeEdit')}>
                  <PinIcon color={colors.muted} size={14} />
                  <Text style={styles.metaText}>{cur.where}</Text>
                </Pressable>
              ) : null}
              {editPlace || (!cur.where && cur.status === 'pendiente') ? (
                editPlace ? (
                  <TextInput
                    value={place}
                    onChangeText={setPlace}
                    autoFocus
                    placeholder={t('ask.placeHere')}
                    placeholderTextColor={colors.faint}
                    style={styles.placeInput}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      useDay.getState().setDetails(cur.id, { where: place.trim() || null });
                      setEditPlace(false);
                    }}
                    onBlur={() => setEditPlace(false)}
                    accessibilityLabel={t('task.placeAdd')}
                  />
                ) : (
                  <Pressable style={styles.meta} onPress={() => { setPlace(''); setEditPlace(true); }} accessibilityRole="button">
                    <PinIcon color={colors.faint} size={14} />
                    <Text style={[styles.metaText, { color: colors.faint }]}>{t('task.placeAdd')}</Text>
                  </Pressable>
                )
              ) : null}
              {travel ? (
                <View style={styles.meta}>
                  <ClockIcon color={colors.muted} size={14} />
                  <Text style={styles.metaText}>{cur.at ? t('travel.leave', { n: travel, at: leaveAt(cur.at, travel) }) : t('travel.only', { n: travel })}</Text>
                </View>
              ) : null}
              {goal ? (
                <View style={styles.meta}>
                  <TargetIcon color={colors.muted} size={14} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {goal.title}
                  </Text>
                </View>
              ) : null}
            </View>

            {cur.status === 'pendiente' ? <PrimerPaso task={cur} /> : null}

            {shopping ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => go(() => router.push({ pathname: '/compra', params: { id: cur.id } }))}
                style={({ pressed }) => [styles.listBtn, pressed && { opacity: 0.85 }]}
              >
                <CartIcon size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{t('shop.open')}</Text>
                  <Text style={styles.metaText}>{t('shop.count', { n: cur.checklist.length })}</Text>
                </View>
              </Pressable>
            ) : cur.checklist.length ? (
              <View style={{ gap: 4 }}>
                {cur.checklist.map((c) => (
                  <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: c.done }} onPress={() => toggleItem(cur.id, c.id)} style={styles.item}>
                    <View style={[styles.box, c.done && styles.boxOn]}>{c.done ? <CheckIcon color={colors.white} size={11} /> : null}</View>
                    <Text style={[styles.itemText, c.done && styles.itemDone]}>{c.text}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {settings && cur.status === 'pendiente' ? (
              <View style={styles.settings}>
                <Text style={styles.label}>{t('sheet.name')}</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onEndEditing={() => title.trim() && title.trim() !== cur.title && rename(cur.id, title.trim())}
                  style={styles.field}
                  accessibilityLabel={t('sheet.name')}
                />
                <Text style={styles.label}>{t('sheet.where')}</Text>
                <TextInput
                  value={where}
                  onChangeText={setWhere}
                  onEndEditing={() => where.trim() !== (cur.where ?? '') && setDetails(cur.id, { where: where.trim() || undefined })}
                  placeholder={t('sheet.wherePh')}
                  placeholderTextColor={colors.faint}
                  style={styles.field}
                />
                <Text style={styles.label}>{t('sheet.duration')}</Text>
                <View style={styles.chips}>
                  {DURATIONS.map((m) => {
                    const on = cur.minutes === m;
                    return (
                      <Pressable key={m} onPress={() => setMinutes(cur.id, m)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                        <Text style={[styles.chipText, on && { color: colors.white }]}>{minutesLabel(m)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>{t('proof.toggle')}</Text>
                    <Text style={styles.metaText}>{cur.proof ?? t('proof.anyPhoto')}</Text>
                  </View>
                  <Switch value={Boolean(cur.needsProof)} onValueChange={(on) => setNeedsProof(cur.id, on)} trackColor={{ true: colors.ink, false: colors.line }} />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleTitle, { flex: 1 }]}>{t('sheet.priority')}</Text>
                  <Switch value={Boolean(cur.top)} onValueChange={() => toggleTop(cur.id)} trackColor={{ true: colors.ink, false: colors.line }} />
                </View>
                <View style={styles.rowBtns}>
                  {cur.day <= today ? (
                    <Pressable onPress={() => go(() => moveTo(cur.id, addDays(today, 1)))} style={styles.secondary} accessibilityRole="button">
                      <Text style={styles.secondaryText}>{t('task.toTomorrow')}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => go(() => moveTo(cur.id, today))} style={styles.secondary} accessibilityRole="button">
                      <Text style={styles.secondaryText}>{t('task.doToday')}</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => go(() => remove(cur.id))} style={[styles.secondary, styles.danger]} accessibilityRole="button" accessibilityLabel={t('task.delete')}>
                    <TrashIcon size={18} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            {appsFor(cur.title).length ? (
              <View style={styles.appsRow}>
                {appsFor(cur.title).map((a) => (
                  <Pressable key={a.id} onPress={() => void openApp(a)} accessibilityRole="link" hitSlop={6}>
                    <Text style={styles.appLink}>{t('task.openIn', { app: a.name })} ↗</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
          {/* The main actions stay visible under the content, whatever its height. */}
          <View style={styles.footer}>
            {cur.status === 'hecha' ? (
                <Pressable onPress={() => go(() => undoDone(cur.id))} style={styles.secondary} accessibilityRole="button">
                  <Text style={styles.secondaryText}>{t('task.undo')}</Text>
                </Pressable>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('focus.start')}
                    onPress={() => go(() => router.push({ pathname: '/foco', params: { id: cur.id } }))}
                    style={({ pressed }) => [styles.focusWrap, pressed && { transform: [{ scale: 0.97 }] }]}
                  >
                    <LinearGradient colors={voz.mic} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.focus}>
                      <PlayIcon size={26} />
                      <Text style={styles.focusText}>{t('focus.start')}</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={proof ? t('proof.take') : t('task.markDone')}
                    onPress={() =>
                      go(() =>
                        proof
                          ? router.push({ pathname: '/prueba', params: { id: cur.id } })
                          : offerProof
                            ? router.push({ pathname: '/prueba', params: { id: cur.id, optional: '1' } })
                            : markDone(cur.id),
                      )
                    }
                    style={({ pressed }) => [styles.photo, pressed && { opacity: 0.8 }]}
                  >
                    {proof ? <CameraIcon size={24} /> : <CheckIcon color={colors.ink} size={22} />}
                    <Text style={styles.photoText}>{proof ? t('sheet.photo') : t('sheet.done')}</Text>
                  </Pressable>
                </View>
              )}

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  placeInput: { minHeight: 40, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, alignSelf: 'stretch' },
  appsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  appLink: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,10,0.4)' },
  footer: { paddingTop: 12 },
  sheet: { maxHeight: '88%', backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 22, paddingTop: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: colors.ink },
  title: { fontSize: 28, lineHeight: 32 },
  done: { color: colors.faint, textDecorationLine: 'line-through' },
  metaRow: { gap: 6, marginTop: -4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textTransform: 'none' },
  listBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.card },
  listTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 38 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  itemText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  itemDone: { color: colors.faint, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'stretch', marginTop: 6 },
  focusWrap: { flex: 1, borderRadius: 32, overflow: 'hidden' },
  focus: { height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  focusText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.white },
  photo: { width: 84, height: 64, borderRadius: 32, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoText: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink },
  settings: { gap: 10, marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 4 },
  field: { minHeight: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.card },
  toggleTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondary: { flex: 1, minHeight: 50, borderRadius: 25, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  danger: { flex: 0, width: 50 },
});
