/**
 * Okio never invents tasks. Every task the AI returns must come from what the person said:
 * at least one meaningful word of its title (or of its shopping list) appears in the text.
 * Goal steps are a plan Okio builds on purpose, so they are not filtered here. Pure, tested.
 */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

const STOP = new Set([
  'hacer', 'tengo', 'tener', 'para', 'porque', 'como', 'esta', 'este', 'mañana', 'manana', 'hoy', 'todo', 'todos', 'algo', 'cosas', 'cosa', 'ir', 'irme',
  'faire', 'aller', 'avec', 'pour', 'demain', 'aujourd', 'chose', 'choses', 'with', 'have', 'need', 'tomorrow', 'today', 'thing', 'things', 'that', 'this',
]);

const stems = (s: string) =>
  norm(s)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .map((w) => w.slice(0, 5));

export function saidIn(text: string, title: string, extra: string[] = []): boolean {
  const said = norm(text);
  const words = [...stems(title), ...extra.flatMap(stems)];
  if (!words.length) return true; // nothing to check (very short titles): keep
  return words.some((w) => said.includes(w));
}

export function keepSaid<T extends { title: string; checklist?: string[] }>(tasks: T[], text: string): T[] {
  if (!text.trim()) return tasks;
  return tasks.filter((x) => saidIn(text, x.title, x.checklist ?? []));
}
