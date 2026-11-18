import * as QuickActions from 'expo-quick-actions';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { t } from '../i18n';

/**
 * Long-press on the app icon: Hablar / Escribir / Siguiente tarea.
 * Only in a development or store build; in Expo Go these calls do nothing.
 * The same screens open from links (getgo://hablar, getgo://escribir, getgo://siguiente)
 * so people can wire them to the Action Button, the Shortcuts app or Siri.
 */
let handledInitial = false;

const go = (action: QuickActions.Action) => {
  const href = action.params?.href;
  if (typeof href === 'string') router.push(href as Href);
};

export function useAtajos() {
  useEffect(() => {
    void QuickActions.setItems([
      { id: 'hablar', title: t('atajo.speak'), icon: 'symbol:mic.fill', params: { href: '/escuchando' } },
      { id: 'escribir', title: t('atajo.write'), icon: 'symbol:square.and.pencil', params: { href: '/escribir' } },
      { id: 'siguiente', title: t('atajo.next'), icon: 'symbol:checkmark.circle', params: { href: '/foco' } },
    ]).catch(() => {});
    if (!handledInitial && QuickActions.initial) {
      handledInitial = true;
      go(QuickActions.initial);
    }
    const sub = QuickActions.addListener(go);
    return () => sub.remove();
  }, []);
}
