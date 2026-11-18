import { Linking } from 'react-native';

/**
 * Apps that fit a task's topic: running → Strava, reading → Books/Kindle, music → GarageBand/Spotify.
 * Light integration for now: a shortcut that opens the app (or its website when it isn't installed).
 */
export type TopicApp = { id: string; name: string; url: string; web: string };

const TOPICS: { words: RegExp; apps: TopicApp[] }[] = [
  {
    words: /\b(corr(er|o)|running|run|jog|trot|courir|course à pied|lopen|hardlopen|laufen|joggen|correre|corsa|correr)\b|\bkm\b/i,
    apps: [{ id: 'strava', name: 'Strava', url: 'strava://', web: 'https://www.strava.com' }],
  },
  {
    words: /\b(le(er|o)|libro|lectura|read(ing)?|book|lire|livre|lezen|boek|lesen|buch|leggere|libro|ler|livro)\b|pág/i,
    apps: [
      { id: 'books', name: 'Libros', url: 'ibooks://', web: 'https://www.apple.com/apple-books/' },
      { id: 'kindle', name: 'Kindle', url: 'kindle://', web: 'https://read.amazon.com' },
    ],
  },
  {
    words: /\b(m[uú]sica|music|canci[oó]n|song|beat|produc|musique|chanson|muziek|nummer|musik|lied|musica|canzone)\w*/i,
    apps: [
      { id: 'garageband', name: 'GarageBand', url: 'garageband://', web: 'https://www.apple.com/garageband/' },
      { id: 'spotify', name: 'Spotify', url: 'spotify://', web: 'https://open.spotify.com' },
    ],
  },
];

export function appsFor(title: string): TopicApp[] {
  return TOPICS.filter((x) => x.words.test(title)).flatMap((x) => x.apps).slice(0, 2);
}

export async function openApp(a: TopicApp) {
  try {
    await Linking.openURL(a.url);
  } catch {
    await Linking.openURL(a.web).catch(() => {});
  }
}
