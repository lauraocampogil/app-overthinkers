import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BackIcon, CheckIcon, IconCircle, PlusIcon, PrimaryButton, Screen } from '@/components/ui';
import { CAPACITY_SHARE } from '@/lib/planner';
import { minutesLabel, t } from '@/i18n';
import { totalMinutes, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const Arrow = ({ up }: { up: boolean }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} stroke={colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function Resumen() {
  const plan = useDay((s) => s.plan);
  const later = useDay((s) => s.later);
  const freeMinutes = useDay((s) => s.settings.freeMinutes);
  const { rename, remove, add, move } = useDay.getState();
  const [editing, setEditing] = useState(false);

  const visible = plan.filter((t) => t.status !== 'quitada');
  const total = totalMinutes(visible);
  const fits = total <= freeMinutes * CAPACITY_SHARE;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('summary.home')} onPress={() => router.replace('/')}>
          <BackIcon />
        </IconCircle>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: editing }}
          onPress={() => setEditing((e) => !e)}
          style={styles.editBtn}
        >
          <Text style={styles.editText}>{t(editing ? 'summary.done' : 'summary.edit')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={type.title} accessibilityRole="header">{t('summary.title')}</Text>
          <Text style={type.muted}>{t('summary.count', { n: visible.length, time: minutesLabel(total) })}</Text>
          <View style={styles.fit}>
            <CheckIcon color={fits ? colors.accentDark : colors.muted} size={16} />
            <Text style={[styles.fitText, !fits && { color: colors.muted }]}>
              {t(fits ? 'summary.fits' : 'summary.tooMuch')}
            </Text>
          </View>
        </View>

        <View style={styles.list}>
          {visible.map((task, i) => (
            <View key={task.id} style={[styles.row, i === visible.length - 1 && { borderBottomWidth: 0 }]}>
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('summary.remove', { title: task.title })}
                  onPress={() => remove(task.id)}
                  style={styles.badge}
                  hitSlop={8}
                >
                  <Text style={[styles.badgeText, { fontSize: 18, lineHeight: 20 }]}>−</Text>
                </Pressable>
              ) : (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{i + 1}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                {editing ? (
                  <TextInput
                    accessibilityLabel={t('summary.taskName')}
                    value={task.title}
                    onChangeText={(v) => rename(task.id, v)}
                    style={styles.input}
                  />
                ) : (
                  <Text style={styles.title}>{task.title}</Text>
                )}
                <View style={styles.meta}>
                  <View style={[styles.imp, task.importance === 3 && styles.impHigh, task.importance === 1 && styles.impLow]}>
                    <Text style={[styles.impText, task.importance === 3 && { color: colors.white }]}>{t(`imp.${task.importance}`)}</Text>
                  </View>
                  <Text style={styles.time}>
                    {minutesLabel(task.minutes)}
                    {task.status === 'hecha' ? t('summary.doneSuffix') : ''}
                  </Text>
                </View>
              </View>
              {editing && (
                <View style={styles.arrows}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('summary.up', { title: task.title })} onPress={() => move(task.id, -1)} hitSlop={6} style={styles.arrow}>
                    <Arrow up />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('summary.down', { title: task.title })} onPress={() => move(task.id, 1)} hitSlop={6} style={styles.arrow}>
                    <Arrow up={false} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>

        {editing ? (
          <Pressable accessibilityRole="button" onPress={() => add(t('summary.newTask'))} style={styles.addBtn}>
            <PlusIcon color={colors.accentDark} />
            <Text style={styles.addText}>{t('summary.add')}</Text>
          </Pressable>
        ) : (
          <Text style={[type.muted, { fontSize: 14, textAlign: 'center' }]}>
            {t('summary.onlyOne')}
            {later.length ? `\n${t('summary.later', { n: later.length })}` : ''}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {editing ? (
          <PrimaryButton dark label={t('summary.save')} onPress={() => setEditing(false)} />
        ) : (
          <PrimaryButton label={t('summary.start')} onPress={() => router.push('/ahora')} disabled={!visible.length} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 44, marginTop: 8 },
  editBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: '#DEDAF0', backgroundColor: colors.white, justifyContent: 'center' },
  editText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  body: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 22 },
  fit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fitText: { fontFamily: fonts.regular, fontSize: 14, color: colors.accentDark },
  list: { borderRadius: 24, backgroundColor: colors.white, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EDFA' },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentDark },
  title: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  time: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  imp: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.soft, justifyContent: 'center' },
  impHigh: { backgroundColor: colors.accentDark },
  impLow: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  impText: { fontFamily: fonts.medium, fontSize: 12, color: colors.accentDark },
  input: { height: 38, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#DEDAF0', backgroundColor: colors.bgTop, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  arrows: { gap: 2 },
  arrow: { width: 32, height: 24, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B4ADD6' },
  addText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accentDark },
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
});
