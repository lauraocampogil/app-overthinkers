import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { track } from '@/lib/eventos';
import { draftFor } from '@/lib/mentor';
import { emailIn, mailtoUrl, phoneIn, stepKindOf, whatsappUrl } from '@/lib/primer-paso';
import type { Task } from '@/lib/types';
import { colors, fonts } from '@/theme';

/**
 * "Primer paso" inside a task: for an email, a message or a call, Okio writes the text.
 * The person edits it if they want and sends it from their own app. Okio never sends.
 */
export function PrimerPaso({ task }: { task: Task }) {
  const kind = stepKindOf(task.title);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(null);
    setCopied(false);
  }, [task.id]);

  if (!kind) return null;
  const to = emailIn(task.title);
  const phone = phoneIn(task.title);
  const channel = kind === 'email' ? 'email' : 'message';

  const write = async () => {
    setBusy(true);
    track('draft', { kind });
    const out = await draftFor({ title: task.title }, channel);
    setBusy(false);
    setDraft(out ?? { subject: kind === 'email' ? task.title : '', body: t('step.fallback') });
  };

  const send = async () => {
    if (!draft) return;
    track('draft', { kind, sent: true });
    if (kind === 'email') {
      await Linking.openURL(mailtoUrl(to, draft.subject, draft.body)).catch(() => {});
      return;
    }
    const wa = whatsappUrl(draft.body, phone);
    try {
      await Linking.openURL(wa);
    } catch {
      await Share.share({ message: draft.body }).catch(() => {});
    }
  };

  const copy = async () => {
    if (!draft) return;
    await Clipboard.setStringAsync(draft.subject ? `${draft.subject}\n\n${draft.body}` : draft.body);
    setCopied(true);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('step.title')}</Text>
      {kind === 'call' && phone ? (
        <Pressable onPress={() => void Linking.openURL(`tel:${phone}`)} accessibilityRole="button" style={styles.row}>
          <Text style={styles.action}>{t('step.call', { phone })}</Text>
        </Pressable>
      ) : null}
      {!draft ? (
        <Pressable onPress={() => void write()} disabled={busy} accessibilityRole="button" style={styles.row}>
          {busy ? <ActivityIndicator color={colors.ink} /> : null}
          <Text style={styles.action}>{busy ? t('step.writing') : t(`step.write.${kind}`)}</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          {kind === 'email' ? (
            <TextInput
              value={draft.subject}
              onChangeText={(v) => setDraft({ ...draft, subject: v })}
              style={styles.subject}
              placeholder={t('step.subject')}
              placeholderTextColor={colors.faint}
              accessibilityLabel={t('step.subject')}
            />
          ) : null}
          <TextInput
            value={draft.body}
            onChangeText={(v) => setDraft({ ...draft, body: v })}
            style={styles.body}
            multiline
            accessibilityLabel={t('step.title')}
          />
          <View style={styles.links}>
            {kind !== 'call' ? (
              <Pressable onPress={() => void send()} accessibilityRole="button" hitSlop={6}>
                <Text style={styles.action}>{kind === 'email' ? t('step.openMail') : t('step.openChat')} ↗</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void copy()} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.muted}>{copied ? t('step.copied') : t('step.copy')}</Text>
            </Pressable>
          </View>
          <Text style={styles.note}>{t('step.note')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  action: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  muted: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  subject: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink, minHeight: 90, maxHeight: 220, textAlignVertical: 'top' },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint },
});
