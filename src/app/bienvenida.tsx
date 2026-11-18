import { getLocales } from 'expo-localization';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Ondas } from '@/components/Ondas';
import { BackIcon, CheckIcon, IconCircle, PrimaryButton, Screen, TextButton } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ensureNotificationPermission } from '@/lib/avisos';
import { connectCalendar, defaultCalendarId, refreshAgenda } from '@/lib/calendario';
import { AREA_ORDER, AREAS, COUNTRIES, EMPTY_PROFILE, STORES, type Area, type AreaId, type Profile } from '@/lib/perfil';
import { defaultRoutine } from '@/lib/rutinas';
import type { RoutineKind } from '@/lib/types';
import { useDay, withDefaults } from '@/store/day';
import { colors, fonts, type } from '@/theme';

/**
 * Onboarding: GetGo gets to know the person so it can decide for them.
 * One question per screen, things to tap rather than to type. Everything can be changed later in Cuenta.
 */
const STEPS = ['intro', 'areas', 'details', 'stores', 'day', 'energy', 'routines', 'permissions', 'goal'] as const;
type Step = (typeof STEPS)[number];

const WAKE = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '10:00'];
const SLEEP = ['21:30', '22:00', '22:30', '23:00', '23:30', '00:00', '00:30', '01:00'];
const WORK = [['08:00', '16:00'], ['09:00', '17:00'], ['09:00', '18:00'], ['14:00', '22:00']] as const;
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const dayName = (d: number) => new Date(2026, 10, 15 + d).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
function countryName(code: string) {
  try {
    const Names = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (c: string) => string } }).DisplayNames;
    return Names ? new Names([locale], { type: 'region' }).of(code) : code;
  } catch {
    return code;
  }
}
const addMinutes = (hhmm: string, delta: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function Chip({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.chip, wide && styles.chipWide, on && styles.chipOn, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function Bienvenida() {
  const params = useLocalSearchParams<{ edit?: string }>();
  const editing = params.edit === '1';
  const user = useAuth((s) => s.session?.user);
  const stored = useDay((s) => s.profile);
  const routines = useDay((s) => s.routines);
  const firstName = ((user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined) ?? '').split(' ')[0];

  const region = (getLocales()[0]?.regionCode ?? '').toUpperCase();
  const [p, setP] = useState<Profile>(() => ({
    ...EMPTY_PROFILE,
    ...stored,
    country: stored.country || (COUNTRIES.includes(region) ? region : 'BE'),
  }));
  const [step, setStep] = useState<Step>(editing ? 'areas' : 'intro');
  const [otherStore, setOtherStore] = useState('');
  const [goal, setGoal] = useState('');
  const [perms, setPerms] = useState({ notif: false, cal: false, cam: false });
  const [steps, setSteps] = useState<Record<RoutineKind, string[]>>(() => ({
    manana: (routines.manana ?? defaultRoutine('manana')).steps.map((s) => s.id),
    noche: (routines.noche ?? defaultRoutine('noche')).steps.map((s) => s.id),
  }));

  const set = (patch: Partial<Profile>) => setP((cur) => ({ ...cur, ...patch }));
  const index = STEPS.indexOf(step);
  const areasWithQuestions = p.areas.filter((a) => AREAS[a.id].questions.length || a.id === 'otra');
  const order = STEPS.filter((s) => s !== 'details' || areasWithQuestions.length);
  const go = (dir: 1 | -1) => {
    const i = order.indexOf(step) + dir;
    if (i < 0) return router.back();
    if (i >= order.length) return finish();
    setStep(order[i]);
  };

  const toggleArea = (id: AreaId) => {
    const has = p.areas.find((a) => a.id === id);
    if (has) set({ areas: p.areas.filter((a) => a.id !== id) });
    else if (p.areas.length < 3) set({ areas: [...p.areas, { id, answers: {} }] });
  };
  const answer = (id: AreaId, q: string, v: string | string[]) =>
    set({ areas: p.areas.map((a) => (a.id === id ? { ...a, answers: { ...a.answers, [q]: v } } : a)) });
  const label = (id: AreaId, v: string) => set({ areas: p.areas.map((a) => (a.id === id ? { ...a, label: v } : a)) });

  const stores = STORES[p.country] ?? [];
  const toggleStore = (s: string) => {
    const has = p.stores.includes(s);
    const next = has ? p.stores.filter((x) => x !== s) : [...p.stores, s];
    set({ stores: next, favoriteStore: next.includes(p.favoriteStore ?? '') ? p.favoriteStore : next[0] ?? null });
  };

  const canGo =
    step === 'areas' ? p.areas.length === 3 && p.areas.every((a) => a.id !== 'otra' || (a.label ?? '').trim()) : step === 'stores' ? p.stores.length > 0 : true;

  // A brain dump built from the answers: the AI turns it into weekly goals and habits (gym 4×/week at Basic-Fit…).
  const dump = useMemo(() => {
    const parts = p.areas.map((a, i) => {
      const name = a.label || t(`area.${a.id}`);
      const details = AREAS[a.id].questions
        .map((q) => {
          const v = a.answers[q.id];
          if (!v || (Array.isArray(v) && !v.length)) return '';
          const text = Array.isArray(v)
            ? v.map((x) => (q.type === 'days' ? dayName(Number(x)) : t(`opt.${x}`))).join(', ')
            : q.type === 'chips' && !/^\d+$/.test(v)
              ? t(`opt.${v}`)
              : v;
          return `${t(`q.${a.id}.${q.id}`)} ${text}`;
        })
        .filter(Boolean)
        .join('; ');
      return `${i + 1}. ${name}${details ? ` (${details})` : ''}`;
    });
    return [`${t('ob.dumpAreas')} ${parts.join(' ')}`, goal.trim() ? `${t('ob.dumpGoal')} ${goal.trim()}` : ''].filter(Boolean).join('\n');
  }, [p.areas, goal]);

  function finish() {
    const store = useDay.getState();
    const profile: Profile = { ...p, onboarded: true };
    store.setProfile(profile);
    // The day window and the routines follow the hours the person gave.
    store.setSettings({ dayStart: p.wake, dayEnd: p.sleep === '00:00' || p.sleep.startsWith('00') || p.sleep.startsWith('01') ? '24:00' : p.sleep });
    for (const kind of ['manana', 'noche'] as const) {
      const base = routines[kind] ?? defaultRoutine(kind);
      store.setRoutine(kind, {
        ...base,
        at: kind === 'manana' ? addMinutes(p.wake, 10) : addMinutes(p.sleep, -45),
        steps: base.steps.filter((s) => steps[kind].includes(s.id)),
        enabled: steps[kind].length > 0,
      });
    }
    if (editing && !goal.trim()) {
      router.back();
      return;
    }
    store.setDraft(dump);
    router.replace('/ordenando');
  }

  const header = (
    <View style={styles.header}>
      {index > 0 || editing ? (
        <IconCircle label={t('common.back')} onPress={() => go(-1)}>
          <BackIcon />
        </IconCircle>
      ) : (
        <View style={{ width: 44 }} />
      )}
      <View style={styles.progress} accessibilityLabel={t('ob.progress', { i: order.indexOf(step) + 1, n: order.length })}>
        {order.map((s, i) => (
          <View key={s} style={[styles.seg, i <= order.indexOf(step) && styles.segOn]} />
        ))}
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  const body = (() => {
    switch (step) {
      case 'intro':
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.introWave}>
              <Ondas mode="calma" height={260} />
            </View>
            <Text style={type.title} accessibilityRole="header">
              {firstName ? t('ob.introTitleName', { name: firstName }) : t('ob.introTitle')}
            </Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.introBody')}</Text>
          </View>
        );
      case 'areas':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.areasTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.areasBody')}</Text>
            <View style={styles.grid}>
              {AREA_ORDER.map((id) => {
                const pos = p.areas.findIndex((a) => a.id === id);
                const on = pos >= 0;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: !on && p.areas.length >= 3 }}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => {});
                      toggleArea(id);
                    }}
                    style={({ pressed }) => [styles.tile, on && styles.tileOn, !on && p.areas.length >= 3 && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
                  >
                    {on ? <Text style={styles.rank}>{pos + 1}</Text> : null}
                    <Text style={[styles.tileText, on && { color: colors.white }]}>{t(`area.${id}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {p.areas.some((a) => a.id === 'otra') ? (
              <TextInput
                value={p.areas.find((a) => a.id === 'otra')?.label ?? ''}
                onChangeText={(v) => label('otra', v)}
                placeholder={t('area.otraPh')}
                placeholderTextColor={colors.faint}
                style={styles.input}
                accessibilityLabel={t('area.otra')}
              />
            ) : null}
            <Text style={styles.hint}>{t('ob.areasCount', { n: p.areas.length })}</Text>
          </>
        );
      case 'details':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.detailsTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.detailsBody')}</Text>
            {areasWithQuestions.map((a: Area) => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.cardTitle}>{a.label || t(`area.${a.id}`)}</Text>
                {AREAS[a.id].questions.map((q) => {
                  const v = a.answers[q.id];
                  return (
                    <View key={q.id} style={{ gap: 8 }}>
                      <Text style={styles.q}>{t(`q.${a.id}.${q.id}`)}</Text>
                      {q.type === 'text' ? (
                        <TextInput
                          value={(v as string) ?? ''}
                          onChangeText={(x) => answer(a.id, q.id, x)}
                          placeholder={t(`q.${a.id}.${q.id}.ph`)}
                          placeholderTextColor={colors.faint}
                          style={styles.input}
                        />
                      ) : q.type === 'days' ? (
                        <View style={styles.row}>
                          {WEEK.map((d) => {
                            const list = (v as string[]) ?? [];
                            const on = list.includes(String(d));
                            return <Chip key={d} label={dayName(d)} on={on} onPress={() => answer(a.id, q.id, on ? list.filter((x) => x !== String(d)) : [...list, String(d)])} />;
                          })}
                        </View>
                      ) : (
                        <View style={styles.row}>
                          {q.options!.map((o) => {
                            const list = Array.isArray(v) ? v : [];
                            const on = q.type === 'multi' ? list.includes(o) : v === o;
                            return (
                              <Chip
                                key={o}
                                label={/^\d+$/.test(o) ? `${o}×` : t(`opt.${o}`)}
                                on={on}
                                onPress={() => answer(a.id, q.id, q.type === 'multi' ? (on ? list.filter((x) => x !== o) : [...list, o]) : o)}
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        );
      case 'stores':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.storesTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.storesBody')}</Text>
            <Text style={styles.q}>{t('ob.country')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {COUNTRIES.map((c) => (
                <Chip key={c} label={countryName(c)} on={p.country === c} onPress={() => set({ country: c, stores: [], favoriteStore: null })} />
              ))}
            </ScrollView>
            <Text style={[styles.q, { marginTop: 8 }]}>{t('ob.storesPick')}</Text>
            <View style={styles.row}>
              {[...stores, ...p.stores.filter((s) => !stores.includes(s))].map((s) => (
                <Chip key={s} label={p.favoriteStore === s ? `★ ${s}` : s} on={p.stores.includes(s)} onPress={() => toggleStore(s)} />
              ))}
            </View>
            <TextInput
              value={otherStore}
              onChangeText={setOtherStore}
              onSubmitEditing={() => {
                const v = otherStore.trim();
                if (v && !p.stores.includes(v)) toggleStore(v);
                setOtherStore('');
              }}
              returnKeyType="done"
              placeholder={t('ob.otherStore')}
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            {p.stores.length > 1 ? (
              <>
                <Text style={[styles.q, { marginTop: 8 }]}>{t('ob.favorite')}</Text>
                <View style={styles.row}>
                  {p.stores.map((s) => (
                    <Chip key={s} label={s} on={p.favoriteStore === s} onPress={() => set({ favoriteStore: s })} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        );
      case 'day':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.dayTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.dayBody')}</Text>
            <Text style={styles.q}>{t('ob.wake')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {WAKE.map((h) => <Chip key={h} label={h} on={p.wake === h} onPress={() => set({ wake: h })} />)}
            </ScrollView>
            <Text style={[styles.q, { marginTop: 8 }]}>{t('ob.sleep')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {SLEEP.map((h) => <Chip key={h} label={h} on={p.sleep === h} onPress={() => set({ sleep: h })} />)}
            </ScrollView>
            <Text style={[styles.q, { marginTop: 8 }]}>{t('ob.work')}</Text>
            <View style={styles.row}>
              {WEEK.map((d) => {
                const on = p.workDays.includes(d);
                return <Chip key={d} label={dayName(d)} on={on} onPress={() => set({ workDays: on ? p.workDays.filter((x) => x !== d) : [...p.workDays, d] })} />;
              })}
            </View>
            <View style={styles.row}>
              {WORK.map(([a, b]) => (
                <Chip key={a + b} label={`${a}–${b}`} on={p.workFrom === a && p.workTo === b} onPress={() => set({ workFrom: a, workTo: b })} />
              ))}
              <Chip label={t('opt.variable')} on={!p.workFrom} onPress={() => set({ workFrom: null, workTo: null })} />
            </View>
          </>
        );
      case 'energy':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.energyTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.energyBody')}</Text>
            <View style={{ gap: 10 }}>
              {(['manana', 'tarde', 'noche'] as const).map((e) => (
                <Chip key={e} wide label={t(`opt.${e}`)} on={p.energy === e} onPress={() => set({ energy: e })} />
              ))}
            </View>
            <Text style={[styles.q, { marginTop: 20 }]}>{t('ob.struggleTitle')}</Text>
            <View style={styles.row}>
              {['start', 'finish', 'prioritize', 'phone', 'estimate'].map((s) => {
                const on = p.struggles.includes(s);
                return <Chip key={s} label={t(`opt.${s}`)} on={on} onPress={() => set({ struggles: on ? p.struggles.filter((x) => x !== s) : [...p.struggles, s] })} />;
              })}
            </View>
          </>
        );
      case 'routines':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.routinesTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.routinesBody')}</Text>
            {(['manana', 'noche'] as const).map((kind) => {
              const base = routines[kind] ?? defaultRoutine(kind);
              const at = kind === 'manana' ? addMinutes(p.wake, 10) : addMinutes(p.sleep, -45);
              return (
                <View key={kind} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{t(`routine.${kind}`)}</Text>
                    <Text style={styles.hint}>{at}</Text>
                  </View>
                  {base.steps.map((s) => {
                    const on = steps[kind].includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        onPress={() => setSteps((cur) => ({ ...cur, [kind]: on ? cur[kind].filter((x) => x !== s.id) : [...cur[kind], s.id] }))}
                        style={styles.stepRow}
                      >
                        <View style={[styles.box, on && styles.boxOn]}>{on ? <CheckIcon color={colors.white} size={12} /> : null}</View>
                        <Text style={[styles.stepText, !on && { color: colors.faint }]}>{s.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </>
        );
      case 'permissions':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.permTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.permBody')}</Text>
            {(
              [
                ['notif', async () => ensureNotificationPermission()],
                [
                  'cal',
                  async () => {
                    if (!(await connectCalendar())) return false;
                    const target = await defaultCalendarId();
                    useDay.getState().setSettings({ calendar: 'write', calendarTarget: target });
                    await refreshAgenda({ ...withDefaults(useDay.getState().settings), calendar: 'write', calendarTarget: target });
                    return true;
                  },
                ],
                ['cam', async () => (await ImagePicker.requestCameraPermissionsAsync()).granted],
              ] as const
            ).map(([key, ask]) => (
              <View key={key} style={styles.perm}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.cardTitle}>{t(`ob.perm.${key}`)}</Text>
                  <Text style={styles.hint}>{t(`ob.perm.${key}Body`)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={perms[key]}
                  onPress={async () => {
                    const ok = await ask().catch(() => false);
                    setPerms((cur) => ({ ...cur, [key]: ok }));
                  }}
                  style={[styles.permBtn, perms[key] && styles.permBtnOn]}
                >
                  <Text style={[styles.permBtnText, perms[key] && { color: colors.muted }]}>{perms[key] ? t('ob.activated') : t('ob.activate')}</Text>
                </Pressable>
              </View>
            ))}
          </>
        );
      case 'goal':
        return (
          <>
            <Text style={type.title} accessibilityRole="header">{t('ob.goalTitle')}</Text>
            <Text style={[type.muted, styles.sub]}>{t('ob.goalBody')}</Text>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              multiline
              placeholder={t('ob.goalPh')}
              placeholderTextColor={colors.faint}
              style={[styles.input, styles.goal]}
              textAlignVertical="top"
            />
          </>
        );
    }
  })();

  const last = order.indexOf(step) === order.length - 1;
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton
            label={step === 'intro' ? t('ob.start') : last ? t('ob.finish') : t('ob.next')}
            onPress={() => go(1)}
            disabled={!canGo}
          />
          {step === 'goal' ? <TextButton label={t('ob.skip')} onPress={finish} /> : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, height: 52, marginTop: 4 },
  progress: { flex: 1, flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line },
  segOn: { backgroundColor: colors.ink },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 12 },
  sub: { marginBottom: 8 },
  introWave: { marginHorizontal: -24, marginTop: 8, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileOn: { backgroundColor: colors.ink },
  tileText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  rank: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, textAlign: 'center', lineHeight: 22, fontFamily: fonts.bold, fontSize: 12, color: colors.ink, overflow: 'hidden' },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 18, gap: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3, color: colors.ink },
  q: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  chipWide: { minHeight: 56, borderRadius: 18, paddingHorizontal: 18 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, textTransform: 'capitalize' },
  chipTextOn: { color: colors.white },
  input: { minHeight: 48, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  goal: { minHeight: 140, paddingTop: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  stepText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  perm: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 20, padding: 16 },
  permBtn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.ink, justifyContent: 'center' },
  permBtnOn: { backgroundColor: colors.white },
  permBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  footer: { paddingHorizontal: 24, paddingBottom: 6, gap: 4 },
});
