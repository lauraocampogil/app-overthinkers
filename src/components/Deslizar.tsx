import { useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { CalendarIcon } from '@/components/Iconos';
import { locale, t } from '@/i18n';
import { addDays } from '@/lib/planner';
import { colors, fonts } from '@/theme';

/**
 * Swipe a task to the left to move it: "Mañana" in one tap, or "Otro día" to pick a day of the week.
 */
export function Deslizar({ children, today, onMove }: { children: ReactNode; today: string; onMove: (day: string) => void }) {
  const ref = useRef<SwipeableMethods>(null);
  const [picking, setPicking] = useState(false);
  const move = (day: string) => {
    ref.current?.close();
    setPicking(false);
    onMove(day);
  };
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));

  return (
    <>
      <ReanimatedSwipeable
        ref={ref}
        friction={1.6}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.actions}>
            <Pressable onPress={() => move(addDays(today, 1))} style={[styles.action, styles.dark]} accessibilityRole="button">
              <Text style={[styles.actionText, { color: colors.white }]}>{t('hoy.tomorrow')}</Text>
            </Pressable>
            <Pressable onPress={() => setPicking(true)} style={styles.action} accessibilityRole="button" accessibilityLabel={t('swipe.otherDay')}>
              <CalendarIcon size={20} />
            </Pressable>
          </View>
        )}
      >
        <View style={{ backgroundColor: colors.bg }}>{children}</View>
      </ReanimatedSwipeable>
      {picking ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setPicking(false)}>
          <Pressable style={styles.overlay} onPress={() => setPicking(false)} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <View style={styles.picker}>
              <Text style={styles.pickerTitle}>{t('swipe.otherDay')}</Text>
              <View style={styles.days}>
                {days.map((d) => (
                  <Pressable key={d} onPress={() => move(d)} style={styles.day} accessibilityRole="button">
                    <Text style={styles.dayText}>{new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric' })}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 },
  action: { height: 48, minWidth: 48, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dark: { backgroundColor: colors.ink },
  actionText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  overlay: { flex: 1, backgroundColor: 'rgba(10,10,10,0.4)', justifyContent: 'center', padding: 24 },
  picker: { backgroundColor: colors.white, borderRadius: 28, padding: 20, gap: 14 },
  pickerTitle: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  days: { gap: 8 },
  day: { minHeight: 50, borderRadius: 16, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 16 },
  dayText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, textTransform: 'capitalize' },
});
