/**
 * "Media hora", "45 minutos", "una hora y media", "1h30", "half an hour", "une heure", "een uur"… → minutes.
 * Used when GetGo asks "¿cuánto tiempo?" and the person answers by voice. null when no duration is heard.
 */
const WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, a: 1, an: 1, one: 1, une: 1, een: 1, ein: 1, eine: 1, um: 1, uma: 1,
  dos: 2, two: 2, deux: 2, twee: 2, zwei: 2, duas: 2, due: 2,
  tres: 3, three: 3, trois: 3, drie: 3, drei: 3, três: 3, tre: 3,
  cuatro: 4, four: 4, quatre: 4, vier: 4, quatro: 4, quattro: 4,
  cinco: 5, five: 5, cinq: 5, vijf: 5, fünf: 5, cinque: 5,
  diez: 10, ten: 10, dix: 10, tien: 10, zehn: 10, dez: 10, dieci: 10,
  quince: 15, fifteen: 15, quinze: 15, vijftien: 15, fünfzehn: 15, quindici: 15,
  veinte: 20, twenty: 20, vingt: 20, twintig: 20, zwanzig: 20, vinte: 20, venti: 20,
  treinta: 30, thirty: 30, trente: 30, dertig: 30, dreißig: 30, trinta: 30, trenta: 30,
  cuarenta: 40, forty: 40, quarante: 40, veertig: 40, vierzig: 40,
  noventa: 90, ninety: 90,
};
const HOUR = /^(h|hr|hrs|hora|horas|hour|hours|heure|heures|uur|stunde|stunden|ora|ore)$/;
const MIN = /^(m|min|mins|minuto|minutos|minute|minutes|minuut|minuten|minuti)$/;
const HALF = /^(media|medio|half|demi|demie|halb|halve|meia|mezza|mezzo)$/;
const FILLER = /^(de|of|an|a|d|une|un|een|uma|um|di|du|ein|eine)$/;
const QUARTER = /^(cuarto|quarter|quart|kwartier|viertel|quarto)$/;

export function parseDuration(input: string): number | null {
  const text = input
    .toLowerCase()
    .replace(/(\d+)\s*h\s*(\d+)/g, '$1 h $2 min') // 1h30
    .replace(/(\d+)(h|min)\b/g, '$1 $2')
    .replace(/[.,!?¿¡]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  let total = 0;
  let found = false;
  let pending: number | null = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const n = /^\d+$/.test(w) ? Number(w) : WORDS[w];
    if (n !== undefined) {
      pending = n;
      continue;
    }
    if (HALF.test(w) || QUARTER.test(w)) {
      const part = HALF.test(w) ? 30 : 15;
      // "media hora", "half an hour", "un cuarto de hora": the hour word belongs to the half/quarter.
      let j = i + 1;
      while (j < words.length && FILLER.test(words[j])) j++;
      if (HOUR.test(words[j] ?? '')) i = j;
      total += part;
      found = true;
      pending = null;
      continue;
    }
    if (HOUR.test(w)) {
      total += (pending ?? 1) * 60;
      pending = null;
      found = true;
      continue;
    }
    if (MIN.test(w)) {
      total += pending ?? 0;
      pending = null;
      found = true;
    }
  }
  // A bare number ("cuarenta", "45") means minutes.
  if (!found && pending !== null) return pending > 0 && pending <= 480 ? pending : null;
  if (pending !== null && found) total += pending; // "una hora 20"
  return found && total > 0 ? Math.min(total, 480) : null;
}
