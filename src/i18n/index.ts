import { getLocales } from 'expo-localization';

import { dictionaries, type Key, type Lang } from './strings';

export type { Key, Lang };

const FALLBACK: Lang = 'en';

function detect(): { lang: Lang; locale: string } {
  for (const l of getLocales()) {
    const code = (l.languageCode ?? '').toLowerCase();
    if (code in dictionaries) return { lang: code as Lang, locale: l.languageTag };
  }
  return { lang: FALLBACK, locale: 'en' };
}

const current = detect();
export const lang = current.lang;
export const locale = current.locale;

type Vars = Record<string, string | number>;

/** t('home.streak', { n: 3 }) picks `home.streak_one` / `home.streak_other` and fills {n}. */
export function t(key: string, vars: Vars = {}): string {
  const dict = dictionaries[lang] as Record<string, string>;
  const base = dictionaries.es as Record<string, string>;
  let k = key;
  if (typeof vars.n === 'number' && !(key in base)) k = `${key}_${vars.n === 1 ? 'one' : 'other'}`;
  const template = dict[k] ?? base[k] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export const minutesLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return [h ? t('time.h', { n: h }) : '', r ? t('time.min', { n: r }) : ''].filter(Boolean).join(' ') || t('time.min', { n: 0 });
};

export const whyText = (keys: Key[] | string[]) => keys.map((k) => t(k)).join(' ');

/** "Lunes, 16 nov" in the phone's language. */
export const todayLabel = () => {
  const s = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Narrow weekday letter (L, M, X… / M, T, W…) for a date. */
export const weekdayLetter = (d: Date) => d.toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase();
