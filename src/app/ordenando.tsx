import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Cargador } from '@/components/Cargador';
import { PreguntaTiempo } from '@/components/PreguntaTiempo';
import { PrimaryButton, Screen } from '@/components/ui';
import { t } from '@/i18n';
import type { ParseResult, RawTask, TaskQuestion } from '@/lib/types';
import { parseBrainDump } from '@/lib/ai';
import { canDump, countDump } from '@/lib/limite';
import { addEntry, useRespuesta } from '@/lib/diario';
import { track } from '@/lib/eventos';
import { todayIso, useDay } from '@/store/day';
import { colors, fonts, type } from '@/theme';

const MIN_MS = 900;
/** An activity with no duration said ("correr", "estudiar"): ask instead of guessing. */
const needsTime = (x: RawTask) => x.minutes === null && (x.askMinutes || x.kind === 'deporte' || x.kind === 'estudio');
/**
 * Things that happen somewhere else (a class, the gym, an appointment) need their place, for the travel time.
 * If the AI did not ask and nobody said where, Okio asks: "¿Dónde es pilates?".
 */
const PLACE_WORDS = /\b(sesi[oó]n|s[ée]ance|session|coach|entrenador|recoger|recojo|chercher|aller chercher|pick up|ophalen|abholen|gare|estaci[oó]n|station|farmacia|pharmacie|pharmacy|apotheek|apotheke|pilates|yoga|gym|gimnasio|basic.?fit|clase|curso|cours|classe|dentista|dentiste|m[ée]dico|m[ée]decin|doctor|cita|rendez-vous|rdv|entreno|entrenamiento|entra[iî]nement|partido|match|reuni[oó]n|r[ée]union|meeting|fisio|kin[ée]|kine|peluquer[ií]a|coiffeur|piscina|piscine|natation|nataci[oó]n|boxe|boxeo|danza|danse|dance|appointment|lesson)\b/i;
/** "el tren", "la gare", "el gym": a kind of place, not an address. Okio still asks which one. */
const VAGUE_PLACE = /^(el |la |los |las |le |les |the |l'|al |à la |au )?(tren|train|estaci[oó]n|gare|station|metro|bus|gym|gimnasio|salle|farmacia|pharmacie|pharmacy|m[ée]dico|m[ée]decin|doctor|dentista|dentiste|clase|cours|class|trabajo|travail|work|oficina|bureau|office|universidad|universit[ée]|uni|escuela|[ée]cole|school|centro|ciudad|ville|city|casa|centre)$/i;
const needsPlace = (x: RawTask) =>
  (!x.where || VAGUE_PLACE.test(x.where.trim())) && (PLACE_WORDS.test(x.title) || (!!x.where && VAGUE_PLACE.test(x.where.trim())) || (!!x.repeat?.days.length && x.kind === 'deporte'));
/**
 * A health or sport goal needs to know the person before it becomes a plan: someone who barely moves,
 * or carries a lot of weight, starts by walking, not running. Okio asks first, then plans.
 */
const BODY_GOAL = /(kilo|kg\b|peso|adelgaz|bajar|perder|maigrir|poids|perdre|lose|weight|afvallen|abnehmen|dimagr|emagrec|forma|fitness|correr|running|marat|courir|m[uú]scul|muscle|deporte|sport)/i;
function goalQuestions(goals: ParseResult['goals']): (TaskQuestion & { task: string; index: number })[] {
  const g = (goals ?? []).find((x) => x.type !== 'semanal' && BODY_GOAL.test(x.title));
  if (!g) return [];
  return [
    { q: t('goalq.level'), kind: 'choice', options: [t('goalq.level1'), t('goalq.level2'), t('goalq.level3'), t('goalq.level4')], task: g.title, index: -1 },
    { q: t('goalq.days'), kind: 'choice', options: ['2', '3', '4', '5'].map((n) => t('goalq.daysN', { n })), task: g.title, index: -1 },
    { q: t('goalq.care'), kind: 'text', task: g.title, index: -1 },
  ];
}

/** Every question to ask, in order: the AI's own ("¿Qué libro?") plus a duration and a place when missing. */
function questionsFor(tasks: RawTask[]) {
  const out: (TaskQuestion & { task: string; index: number })[] = [];
  tasks.forEach((x, index) => {
    for (const a of x.ask ?? []) out.push({ ...a, task: x.title, index });
    if (needsTime(x) && !(x.ask ?? []).some((a) => a.kind === 'minutes')) out.push({ q: t('order.howLongFor', { task: x.title.charAt(0).toLowerCase() + x.title.slice(1) }), kind: 'minutes', task: x.title, index });
    if (needsPlace(x) && !(x.ask ?? []).some((a) => a.kind === 'place'))
      out.push({ q: x.where ? t('order.whereExactly', { place: x.where }) : t('order.whereFor', { task: x.title.charAt(0).toLowerCase() + x.title.slice(1) }), kind: 'place', task: x.title, index });
  });
  return out.slice(0, 6);
} // a short beat so it feels sorted, without making anyone wait

export default function Ordenando() {
  // Read the brain dump once: addTasks() clears the draft.
  const draftRef = useRef(useDay.getState().draft);
  const addParsed = useDay((s) => s.addParsed);
  const [empty, setEmpty] = useState(false);
  const [ask, setAsk] = useState<{ result: ParseResult; started: number; text: string } | null>(null);

  const save = (result: ParseResult, started: number) => {
    // Everything said is a journal entry too (kept on the phone), with Okio's answer.
    const said = draftRef.current.trim();
    if (said) addEntry(todayIso(), said, result.reflection);
    if (result.reflection) useRespuesta.setState({ day: todayIso(), text: result.reflection, hidden: false });
    const added = addParsed(result);
    track('plan', { proposed: result.tasks.length, kept: 1 });
    // A short beat so it feels sorted, then straight to the list with a small confirmation.
    const wait = Math.max(0, MIN_MS - (Date.now() - started));
    setTimeout(() => router.replace({ pathname: '/', params: { added: added.added, today: added.today, later: added.later, goals: added.goals } }), wait);
  };

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      const text = draftRef.current.trim();
      // Free plan: one dump a day. The draft stays, so nothing said is lost.
      if (text && !(await canDump())) {
        if (alive) router.replace({ pathname: '/pro', params: { next: 'ordenando', reason: 'limit' } });
        return;
      }
      if (text) countDump();
      track('dump', { source: 'home' });
      const result: ParseResult = text ? await parseBrainDump(text) : { tasks: [], goals: [], tired: false };
      if (!alive) return;
      if (!result.tasks.length && !result.goals?.length) {
        // Nothing to do, only things on the mind: it is a journal entry; Okio answers on Hoy.
        if (result.reflection) {
          save(result, started);
          return;
        }
        setEmpty(true);
        return;
      }
      if (goalQuestions(result.goals).length || questionsFor(result.tasks).length) {
        setAsk({ result, started, text });
        return;
      }
      save(result, started);
    })();
    return () => {
      alive = false;
    };
  }, [addParsed]);

  if (ask) {
    const gq = goalQuestions(ask.result.goals);
    const qs = [...gq, ...questionsFor(ask.result.tasks)];
    return (
      <PreguntaTiempo
        questions={qs}
        onDone={async (answers) => {
          // Goal answers: plan again, now knowing the person (level, days, what to be careful with).
          const about = gq
            .map((q, k) => (answers[k]?.text ? `${q.q} ${answers[k]!.text}` : ''))
            .filter(Boolean)
            .join(' ');
          if (about) {
            setAsk(null);
            const again = await parseBrainDump(`${ask.text}\n${t('goalq.context', { goal: gq[0].task })} ${about}`);
            const result = again.goals?.length || again.tasks.length ? again : ask.result;
            if (questionsFor(result.tasks).length) {
              setAsk({ result, started: Date.now(), text: '' });
              return;
            }
            save(result, Date.now() - MIN_MS);
            return;
          }
          const tasks = ask.result.tasks.map((x) => ({ ...x }));
          answers.forEach((a, k) => {
            if (!a || k < gq.length) return;
            const q = qs[k];
            const task = tasks[q.index];
            if (a.minutes) Object.assign(task, { minutes: a.minutes, askMinutes: false });
            if (a.text && q.kind === 'place') task.where = a.text.slice(0, 120);
            else if (a.text) task.title = q.template ? q.template.replace('{}', a.text) : `${task.title}: ${a.text}`;
            if (a.dueInDays !== undefined) task.dueInDays = a.dueInDays;
          });
          save({ ...ask.result, tasks: tasks.map((x) => ({ ...x, ask: [] })) }, Date.now() - MIN_MS);
        }}
      />
    );
  }

  if (empty) {
    return (
      <Screen style={styles.pad}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
          <Text style={type.title}>{t('order.emptyTitle')}</Text>
          <Text style={type.muted}>{t('order.emptyBody')}</Text>
        </View>
        <PrimaryButton label={t('order.retry')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 32 }}>
        <Cargador />
        <Text style={[type.title, { fontSize: 26, textAlign: 'center' }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {t('order.title')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingBottom: 12 },
  titleBlock: { paddingHorizontal: 24, marginTop: 56, gap: 8 },
  steps: { paddingHorizontal: 44, gap: 14, minHeight: 100, marginBottom: 20 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, flexShrink: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: 12 },
  askBody: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 30, gap: 12 },
  askCard: { padding: 16, borderRadius: 22, backgroundColor: colors.card, gap: 12, marginTop: 4 },
  askTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
});
