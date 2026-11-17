import type { Energy, Kind, ParseResult, RawTask } from './types';

/**
 * Offline fallback when the AI is not configured: splits the brain dump into tasks
 * and guesses type, energy and deadline from common Spanish words. A duration is only kept
 * when the person says it ("1 hora de gym", "20 min"); GetGo never invents one.
 */
const TIRED = /\b(cansad[oa]s?|agotad[oa]s?|sin energ[ií]a|reventad[oa]s?|con sueño)\b/i;

const KIND_WORDS: Array<[Kind, RegExp]> = [
  ['deporte', /\b(gym|gimnasio|correr|cardio|fuerza|pesas|entren\w*|yoga|nadar|pilates|f[uú]tbol|bici)\b/i],
  ['estudio', /\b(estudi\w*|examen|deberes|tarea de|leer|apuntes|repasar|clase|curso|tfg|trabajo de clase)\b/i],
  ['trabajo', /\b(jefe|cliente|reuni[oó]n|mail|correo|email|informe|presentaci[oó]n|propuesta|factura|llamar a)\b/i],
  ['casa', /\b(lavar|ropa|limpiar|compra|comprar|cocinar|basura|ordenar|recoger|banco|farmacia|recado)\b/i],
];

export function minutesFrom(text: string): number | null {
  if (/\bmedia hora\b/i.test(text)) return 30;
  if (/\bhora y media\b/i.test(text)) return 90;
  if (/\b(una|1) hora\b/i.test(text)) return 60;
  const h = text.match(/\b(\d+(?:[.,]\d+)?)\s*(h|hs|horas?)\b/i);
  if (h) return Math.round(parseFloat(h[1].replace(',', '.')) * 60);
  const m = text.match(/\b(\d+)\s*(m|min|mins|minutos?)\b/i);
  return m ? Number(m[1]) : null;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'mi[eé]rcoles', 'jueves', 'viernes', 's[aá]bado'];

export function dueInDaysFrom(text: string, today: Date = new Date()): number | null {
  if (/\b(hoy|esta tarde|esta noche|ya)\b/i.test(text)) return 0;
  if (/\bpasado mañana\b/i.test(text)) return 2;
  if (/\bmañana\b/i.test(text)) return 1;
  for (let d = 0; d < 7; d++) {
    if (new RegExp(`\\b(el\\s+)?${WEEKDAYS[d]}\\b`, 'i').test(text)) {
      const diff = (d - today.getDay() + 7) % 7;
      return diff === 0 ? 7 : diff;
    }
  }
  return null;
}

function cleanTitle(s: string): string {
  const t = s
    .replace(/^(tengo que|tengo|debo|hay que|necesito|quiero|me toca|y)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function parseLocal(text: string, today: Date = new Date()): ParseResult {
  const tired = TIRED.test(text);
  const pieces = text
    .split(/[,;\n.]+|\s+y\s+(?=[a-záéíóúñ])/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && !TIRED.test(p) && !/^(estoy|me siento)\b/i.test(p));

  const tasks: RawTask[] = [];
  // "gym y cardio" is split on " y " too, so the planner can order strength before cardio.
  for (const p of pieces) {
    const kind = KIND_WORDS.find(([, re]) => re.test(p))?.[0] ?? 'otro';
    const minutes = minutesFrom(p);
    const energy: Energy = kind === 'estudio' || kind === 'deporte' || (minutes ?? 0) >= 30 ? 'alta' : 'baja';
    const sport = /\b(cardio|correr|bici)\b/i.test(p) ? 'cardio' : /\b(gym|gimnasio|fuerza|pesas)\b/i.test(p) ? 'fuerza' : null;
    const dueInDays = dueInDaysFrom(p, today);
    const importance: 1 | 2 | 3 =
      (dueInDays !== null && dueInDays <= 2) || /\b(urgente|importante|ya mismo)\b/i.test(p)
        ? 3
        : kind === 'trabajo' || kind === 'estudio' || kind === 'deporte'
          ? 2
          : 1;
    tasks.push({ title: cleanTitle(p), minutes, dueInDays, energy, kind, sport, importance });
  }
  return { tasks, tired };
}
