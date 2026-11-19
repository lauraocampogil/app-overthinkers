/**
 * "… a las 6", "… a las 18h", "… à 18h30", "… at 6pm" at the end of a title → its hour and the title without it.
 * "a las 6" with no "mañana"/"am" means 18:00 (people say the afternoon hour that way). Pure, tested.
 */
export function timeInTitle(title: string): { title: string; at: string } | null {
  const m = /\s*(?:a las|a la|à|at|om|um|alle|às)\s+(\d{1,2})(?:[:h.](\d{2}))?\s*(h|am|pm|de la mañana|de la tarde|de la noche|du matin|du soir)?\s*$/i.exec(title);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  const tag = (m[3] ?? '').toLowerCase();
  const morning = tag === 'am' || tag.includes('mañana') || tag.includes('matin');
  if ((tag === 'pm' || tag.includes('tarde') || tag.includes('noche') || tag.includes('soir') || (!morning && tag !== 'h' && h >= 1 && h <= 7)) && h < 12) h += 12;
  const rest = title.slice(0, m.index).trim();
  if (!rest) return null;
  return { title: rest, at: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` };
}
