/**
 * The first step of a task, so it is two minutes from started.
 * For an email, a message or a call Okio writes the text; the person reviews it and sends it themselves.
 * Okio never sends anything on its own.
 */
export type StepKind = 'email' | 'message' | 'call';

const EMAIL = /\b(e-?mails?|mail|correo|courriel|mailen|mailtje|mailer)\b|@/i;
const MESSAGE = /\b(mensaje|whatsapp|wasap|sms|message|texto|bericht|appen|nachricht|messaggio|mensagem|dm|telegram|escribir a|responder a|contestar a|écrire à|répondre à|write to|text|reply to|schrijven aan|schreiben an|scrivere a|rispondere a|escrever para?)\b/i;
const CALL = /\b(llamar|llamada|telefonear|call|ring|phone|appeler|appel|téléphoner|bellen|anrufen|telefonieren|chiamare|telefonare|ligar|telefonar)\b/i;

export function stepKindOf(title: string): StepKind | null {
  if (EMAIL.test(title)) return 'email';
  if (CALL.test(title)) return 'call';
  if (MESSAGE.test(title)) return 'message';
  return null;
}

export const emailIn = (text: string) => /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0] ?? null;
export const phoneIn = (text: string) => {
  const m = /(\+?\d[\d\s.-]{7,}\d)/.exec(text)?.[1];
  return m ? m.replace(/[\s.-]/g, '') : null;
};

export function mailtoUrl(to: string | null, subject: string, body: string) {
  const q = [subject ? `subject=${encodeURIComponent(subject)}` : '', `body=${encodeURIComponent(body)}`].filter(Boolean).join('&');
  return `mailto:${to ?? ''}?${q}`;
}

export const whatsappUrl = (body: string, phone?: string | null) =>
  `whatsapp://send?${phone ? `phone=${encodeURIComponent(phone.replace(/^\+/, ''))}&` : ''}text=${encodeURIComponent(body)}`;
