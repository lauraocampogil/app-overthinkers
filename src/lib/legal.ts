import * as WebBrowser from 'expo-web-browser';

/**
 * Public web pages (the web/ folder of this repo, deployed on the Okio domain).
 * Apple asks for a privacy policy link inside the app; set EXPO_PUBLIC_SITE_URL once the site is live.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://okio.app').replace(/\/$/, '');

export function openPage(page: 'privacidad' | 'terminos' | 'soporte' | 'eliminar-cuenta') {
  if (!SITE_URL) return;
  void WebBrowser.openBrowserAsync(`${SITE_URL}/${page}.html`).catch(() => {});
}
