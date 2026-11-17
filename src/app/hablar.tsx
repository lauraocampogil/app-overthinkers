import { Redirect } from 'expo-router';

/** Shortcut target: getgo://hablar opens the voice screen straight away (Action Button, Shortcuts, Siri, widgets). */
export default function Hablar() {
  return <Redirect href="/escuchando" />;
}
