import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { CheckIcon } from '@/components/ui';
import { locale, minutesLabel, t, weekdayLetter } from '@/i18n';
import type { FixedItem } from '@/lib/perfil';
import { colors, fonts, type } from '@/theme';

/** Monday first. 0 = Sunday … 6 = Saturday, like Date.getDay(). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const MINUTES = [30, 60, 90, 120];
const SUGGESTIONS = ['gym', 'training', 'classes', 'groceries', 'laundry', 'cleaning', 'cook'] as const;

const letter = (dow: number) => weekdayLetter(new Date(2024, 0, 7 + dow)); // 7 Jan 2024 was a Sunday
const dayName = (dow: number) => new Date(2024, 0, 7 + dow).toLocaleDateString(locale, { weekday: 'short' });

/** "19" → "19:00", "730" → "07:30", "19.30" → "19:30". null when it does not look like a time. */
export function normTime(v: string): string | null {
  const d = v.replace(/[^0-9]/g, '');
  if (!d) return null;
  const h = d.length <= 2 ? Number(d) : Number(d.slice(0, d.length - 2));
  const m = d.length <= 2 ? 0 : Number(d.slice(-2));
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The fixed week: things that repeat and almost never change (football Tue/Thu 19:00, classes, gym…).
 * GetGo puts them on the right days every week, so planning only covers what is new.
 */
export function SemanaFija({ items, onChange }: { items: FixedItem[]; onChange: (items: FixedItem[]) => void }) {
  const [text, setText] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [at, setAt] = useState('');
  const [minutes, setMinutes] = useState<number | null>(null);
  const ready = text.trim().length > 1 && days.length > 0;

  const add = () => {
    if (!ready) return;
    onChange([...items, { id: `fx-${Date.now().toString(36)}`, text: text.trim(), days: WEEK.filter((d) => days.includes(d)), at: normTime(at), minutes }]);
    setText('');
    setDays([]);
    setAt('');
    setMinutes(null);
  };

  return (
    <View style={{ gap: 12 }}>
      {items.map((f) => (
        <Animated.View key={f.id} entering={FadeInDown.duration(320)} exiting={FadeOut.duration(180)} layout={LinearTransition} style={styles.item}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.itemTitle}>{f.text}</Text>
            <Text style={styles.itemMeta}>
              {[f.days.map(dayName).join(' · '), f.at ?? '', f.minutes ? minutesLabel(f.minutes) : ''].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <Pressable onPress={() => onChange(items.filter((x) => x.id !== f.id))} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('task.delete')}>
            <Text style={styles.remove}>×</Text>
          </Pressable>
        </Animated.View>
      ))}

      <Animated.View layout={LinearTransition} style={styles.form}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('fixed.placeholder')}
          placeholderTextColor={colors.faint}
          style={styles.input}
          returnKeyType="done"
        />
        {!text ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {SUGGESTIONS.map((k) => (
              <Pressable key={k} onPress={() => setText(t(`fixed.sug.${k}`))} style={styles.sug} accessibilityRole="button">
                <Text style={styles.sugText}>{t(`fixed.sug.${k}`)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={type.label}>{t('fixed.days')}</Text>
        <View style={styles.week}>
          {WEEK.map((d) => {
            const on = days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => setDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))}
                style={[styles.day, on && styles.dayOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={dayName(d)}
              >
                <Text style={[styles.dayText, on && { color: colors.white }]}>{letter(d)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <TextInput
            value={at}
            onChangeText={setAt}
            onBlur={() => setAt((v) => normTime(v) ?? '')}
            placeholder={t('fixed.at')}
            placeholderTextColor={colors.faint}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, styles.time]}
            accessibilityLabel={t('fixed.at')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {MINUTES.map((m) => (
              <Pressable key={m} onPress={() => setMinutes(minutes === m ? null : m)} style={[styles.chip, minutes === m && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: minutes === m }}>
                <Text style={[styles.chipText, minutes === m && { color: colors.white }]}>{minutesLabel(m)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable onPress={add} disabled={!ready} style={[styles.addBtn, !ready && { opacity: 0.35 }]} accessibilityRole="button">
          <CheckIcon color={colors.white} size={16} />
          <Text style={styles.addText}>{t('fixed.add')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.ink },
  itemTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
  itemMeta: { fontFamily: fonts.regular, fontSize: 13, color: '#A6A6A6', textTransform: 'capitalize' },
  remove: { fontFamily: fonts.regular, fontSize: 24, color: '#8A8A8A', paddingHorizontal: 4 },
  form: { padding: 16, borderRadius: 24, backgroundColor: colors.card, gap: 12 },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.white, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  sug: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  sugText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.ink },
  dayText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { width: 92, textAlign: 'center' },
  chip: { minHeight: 40, paddingHorizontal: 13, borderRadius: 20, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 25, backgroundColor: colors.ink },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.white },
});
