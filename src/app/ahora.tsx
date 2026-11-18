import { Redirect } from 'expo-router';

/** The old "Ahora" screen became the focus session (app/foco.tsx). Kept so old links and shortcuts still work. */
export default function Ahora() {
  return <Redirect href="/foco" />;
}
