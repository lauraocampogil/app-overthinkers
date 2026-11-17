import { Redirect } from 'expo-router';

/** Shortcut target: getgo://siguiente opens the current task in focus mode. */
export default function Siguiente() {
  return <Redirect href="/ahora" />;
}
