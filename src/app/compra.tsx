import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CameraIcon, MinusIcon, PinIcon, PlusSmallIcon } from '@/components/Iconos';
import { CheckIcon, CloseIcon, IconCircle, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { AISLES, CATALOG, aisleOf, joinQty, splitQty, type Aisle } from '@/lib/compra';
import { useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Shopping list for one task. "Preparar": tap products by aisle and set how many.
 * "En la tienda": the list in aisle order, tick as you go, then the photo closes the task.
 */
export default function Compra() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const task = useDay((s) => s.tasks.find((x) => x.id === id));
  const favorite = useDay((s) => s.profile.favoriteStore);
  const { addItem, setItemText, removeItem, toggleItem } = useDay.getState();
  const [mode, setMode] = useState<'prep' | 'store'>(task && task.checklist.length ? 'store' : 'prep');
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState<Aisle | null>('fruta');

  if (!task) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconCircle label={t('common.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconCircle>
        </View>
      </Screen>
    );
  }

  const items = task.checklist.map((c) => ({ ...c, ...splitQty(c.text), aisle: aisleOf(c.text) }));
  const findItem = (name: string) => items.find((i) => i.name.toLowerCase() === name.toLowerCase());
  const tap = () => void Haptics.selectionAsync().catch(() => {});
  const plus = (name: string) => {
    tap();
    const it = findItem(name);
    if (it) setItemText(task.id, it.id, joinQty(it.name, it.qty + 1));
    else addItem(task.id, name);
  };
  const minus = (name: string) => {
    tap();
    const it = findItem(name);
    if (!it) return;
    if (it.qty <= 1) removeItem(task.id, it.id);
    else setItemText(task.id, it.id, joinQty(it.name, it.qty - 1));
  };
  const addTyped = () => {
    const v = typed.trim();
    if (v) plus(v.charAt(0).toUpperCase() + v.slice(1));
    setTyped('');
  };
  const done = items.filter((i) => i.done).length;
  const store = task.where || favorite;

  return (
    <Screen>
      <View style={styles.header}>
        <IconCircle label={t('common.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconCircle>
        <View style={styles.seg}>
          {(['prep', 'store'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
              <Text style={[styles.segText, mode === m && { color: colors.white }]}>{t(`shop.${m}`)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={type.title} accessibilityRole="header">
          {t('shop.title')}
        </Text>
        <View style={styles.storeRow}>
          {store ? <PinIcon color={colors.muted} size={15} /> : null}
          <Text style={type.muted}>
            {store ? `${store} · ` : ''}
            {mode === 'store' ? t('shop.progress', { done, total: items.length }) : t('shop.count', { n: items.length })}
          </Text>
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={addTyped}
            blurOnSubmit={false}
            returnKeyType="done"
            placeholder={t('shop.addPh')}
            placeholderTextColor={colors.faint}
            style={styles.input}
            accessibilityLabel={t('shop.addPh')}
          />
        </View>

        {mode === 'prep'
          ? AISLES.filter((a) => a !== 'otros').map((aisle) => {
              const products = CATALOG.filter((p) => p.aisle === aisle);
              const count = items.filter((i) => i.aisle === aisle).length;
              const expanded = open === aisle;
              return (
                <View key={aisle} style={styles.aisle}>
                  <Pressable onPress={() => setOpen(expanded ? null : aisle)} style={styles.aisleHead} accessibilityRole="button" accessibilityState={{ expanded }}>
                    <Text style={styles.aisleTitle}>{t(`aisle.${aisle}`)}</Text>
                    {count ? <Text style={styles.badge}>{count}</Text> : null}
                  </Pressable>
                  {expanded
                    ? products.map((p) => {
                        const it = findItem(p.name);
                        return (
                          <View key={p.name} style={styles.product}>
                            <Text style={[styles.productText, it && { fontFamily: fonts.semibold }]}>{p.name}</Text>
                            {it ? (
                              <View style={styles.stepper}>
                                <Pressable onPress={() => minus(p.name)} style={styles.stepBtn} accessibilityLabel={`${t('shop.less')} ${p.name}`} hitSlop={6}>
                                  <MinusIcon size={16} />
                                </Pressable>
                                <Text style={styles.qty}>{it.qty}</Text>
                                <Pressable onPress={() => plus(p.name)} style={[styles.stepBtn, styles.stepOn]} accessibilityLabel={`${t('shop.more')} ${p.name}`} hitSlop={6}>
                                  <PlusSmallIcon size={16} color={colors.white} />
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable onPress={() => plus(p.name)} style={styles.stepBtn} accessibilityLabel={`${t('shop.add')} ${p.name}`} hitSlop={6}>
                                <PlusSmallIcon size={16} />
                              </Pressable>
                            )}
                          </View>
                        );
                      })
                    : null}
                </View>
              );
            })
          : AISLES.map((aisle) => {
              const list = items.filter((i) => i.aisle === aisle);
              if (!list.length) return null;
              return (
                <View key={aisle} style={{ gap: 4 }}>
                  <Text style={styles.storeAisle}>{t(`aisle.${aisle}`).toUpperCase()}</Text>
                  {list.map((i) => (
                    <Pressable
                      key={i.id}
                      onPress={() => {
                        tap();
                        toggleItem(task.id, i.id);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: i.done }}
                      style={styles.tickRow}
                    >
                      <View style={[styles.box, i.done && styles.boxOn]}>{i.done ? <CheckIcon color={colors.white} size={13} /> : null}</View>
                      <Text style={[styles.tickText, i.done && styles.tickDone]}>{i.name}</Text>
                      {i.qty > 1 ? <Text style={styles.tickQty}>× {i.qty}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              );
            })}
        {mode === 'store' && !items.length ? <Text style={type.muted}>{t('shop.empty')}</Text> : null}
      </ScrollView>

      {mode === 'store' && items.length ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace({ pathname: '/prueba', params: { id: task.id } })}
            style={({ pressed }) => [styles.photoBtn, done < items.length && styles.photoSoft, pressed && { opacity: 0.85 }]}
          >
            <CameraIcon color={done < items.length ? colors.ink : colors.white} size={20} />
            <Text style={[styles.photoText, done < items.length && { color: colors.ink }]}>{t('shop.photo')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 56, marginTop: 4 },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, backgroundColor: colors.card },
  segBtn: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120, gap: 12 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  addRow: { marginTop: 4 },
  input: { minHeight: 50, paddingHorizontal: 16, borderRadius: 25, backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  aisle: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16 },
  aisleHead: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aisleTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, color: colors.white, textAlign: 'center', lineHeight: 24, fontFamily: fonts.semibold, fontSize: 12, overflow: 'hidden', paddingHorizontal: 6 },
  product: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, borderTopWidth: 1, borderTopColor: colors.line },
  productText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepOn: { backgroundColor: colors.ink },
  qty: { minWidth: 20, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  storeAisle: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, color: colors.muted, marginTop: 10 },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.card },
  box: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tickText: { flex: 1, fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  tickDone: { color: colors.faint, textDecorationLine: 'line-through' },
  tickQty: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 32 },
  photoBtn: { height: 58, borderRadius: 29, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoSoft: { backgroundColor: colors.card },
  photoText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});
