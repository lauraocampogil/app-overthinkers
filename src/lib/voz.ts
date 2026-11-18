import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModule as SpeechModule } from 'expo-speech-recognition';

/**
 * Live speech-to-text with the phone's own recogniser (iOS Speech / Android SpeechRecognizer).
 * Text appears while the person talks, costs nothing and needs no server.
 *
 * The native module only exists in a development / store build, not in Expo Go.
 * There `liveSpeechAvailable()` is false and the app falls back to recording + Whisper on the server.
 */
const native = requireOptionalNativeModule<typeof SpeechModule>('ExpoSpeechRecognition');

export function liveSpeechAvailable(): boolean {
  try {
    return !!native && native.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function requestLivePermission(): Promise<boolean> {
  if (!native) return false;
  const res = await native.requestPermissionsAsync();
  return res.granted;
}

const DEFAULT_REGION: Record<string, string> = {
  es: 'es-ES', en: 'en-US', fr: 'fr-FR', nl: 'nl-NL', de: 'de-DE', pt: 'pt-PT', it: 'it-IT',
};

/**
 * The phone's language tag (e.g. "es-BE") is not always one the recogniser supports.
 * Pick the exact tag if supported, else the usual variant of the same language, else any variant of it.
 */
export async function pickLocale(locale: string, lang: string): Promise<string> {
  const fallback = DEFAULT_REGION[lang] ?? locale;
  if (!native) return fallback;
  try {
    const { locales } = await native.getSupportedLocales({});
    const list = locales.map((l) => l.replace('_', '-'));
    if (!list.length) return fallback;
    const exact = list.find((l) => l.toLowerCase() === locale.toLowerCase());
    if (exact) return exact;
    const usual = list.find((l) => l.toLowerCase() === fallback.toLowerCase());
    if (usual) return usual;
    return list.find((l) => l.toLowerCase().startsWith(`${lang}-`)) ?? fallback;
  } catch {
    return fallback;
  }
}

type Handlers = {
  onText: (text: string) => void;
  /** 0..1 */
  onLevel: (level: number) => void;
  onError: (code: string) => void;
};

export type LiveSession = {
  /** Stops listening: the live transcript, and the recorded audio (for a more accurate pass on the server). */
  finish: () => Promise<{ text: string; uri: string | null }>;
  cancel: () => void;
};

const joinText = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b).trim();

export function startLive(lang: string, h: Handlers): LiveSession {
  if (!native) throw new Error('speech recognition not available');
  let committed = '';
  let interim = '';
  let ended = false;
  let audioUri: string | null = null;
  let resolveEnd: (() => void) | null = null;
  const endPromise = new Promise<void>((r) => (resolveEnd = r));
  const full = () => joinText(committed, interim);

  const subs = [
    native.addListener('result', (e) => {
      const text = e.results[0]?.transcript?.trim() ?? '';
      if (!text) return;
      if (e.isFinal) {
        // iOS sends the whole session in one final; Android sends one final per sentence.
        committed = text.startsWith(committed) ? text : joinText(committed, text);
        interim = '';
      } else {
        interim = text.startsWith(committed) && committed ? text.slice(committed.length).trim() : text;
      }
      h.onText(full());
    }),
    native.addListener('volumechange', (e) => h.onLevel(Math.min(1, Math.max(0, (e.value + 1) / 10)))),
    native.addListener('error', (e) => {
      // "no-speech" just means silence; "aborted" is our own cancel.
      if (e.error !== 'no-speech' && e.error !== 'aborted') h.onError(e.error);
    }),
    native.addListener('audioend', (e) => {
      if (e.uri) audioUri = e.uri;
    }),
    native.addListener('end', () => {
      ended = true;
      resolveEnd?.();
    }),
  ];
  const cleanup = () => subs.forEach((s) => s.remove());

  // A session left open (another screen, an earlier answer) makes the next start fail silently: reset first.
  try {
    native.abort();
  } catch {
    // nothing to abort
  }
  native.start({
    lang,
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    maxAlternatives: 1,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    // Keep the audio too: Whisper on the server then gives the final, more accurate text.
    recordingOptions: { persist: true },
  });

  return {
    finish: async () => {
      if (!ended) {
        native.stop();
        // The last result arrives just before "end"; don't wait forever if it never comes.
        await Promise.race([endPromise, new Promise((r) => setTimeout(r, 2500))]);
      }
      cleanup();
      return { text: cleanFillers(full()), uri: audioUri };
    },
    cancel: () => {
      try {
        native.abort();
      } catch {
        // already stopped
      }
      cleanup();
    },
  };
}

/**
 * Hesitations people say while thinking ("eh", "em", "mmm", "o sea"…) are not tasks: drop them
 * before the text is shown or sent.
 */
const FILLERS = /(^|[\s,.;])(e+h+|e+m+|m{2,}|u+h+|u+m+|eh?m+|ehh+|ahh+|este+|o sea|pues nada|euh+|bah|ähm|äh|ehm|uhm)(?=[\s,.;!?]|$)/gi;
export function cleanFillers(text: string): string {
  return text
    .replace(FILLERS, '$1')
    .replace(/([,;])\s*[,;]+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[,.;\s]+/, '')
    .trim();
}
