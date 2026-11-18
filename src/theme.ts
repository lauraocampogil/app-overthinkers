/**
 * Monochrome: white, black and greys. The only colour in the app belongs to the person:
 * their mascot, and the voice gradient that slowly turns into the mascot's colours (see lib/paleta.ts).
 * Key names are kept from the old palette so every screen picks up the new look.
 */
export const colors = {
  bg: '#FFFFFF',
  card: '#F4F4F4',
  ink: '#0A0A0A',
  muted: '#6E6E6E',
  faint: '#A6A6A6',
  line: '#E6E6E6',
  soft: '#F1F1F1',
  /** Old accents: now black / dark greys. */
  accent: '#0A0A0A',
  accentDark: '#0A0A0A',
  accentLight: '#3A3A3A',
  white: '#FFFFFF',
  danger: '#D93636',
  /** Kept so older imports compile; all neutral now. */
  bgTop: '#FFFFFF',
  bgMid: '#FFFFFF',
  bgBottom: '#FFFFFF',
  pink: '#E6E6E6',
  peach: '#E6E6E6',
  lilac: '#E6E6E6',
} as const;

export const gradients = {
  background: [colors.bg, colors.bg, colors.bg] as const,
  action: [colors.ink, colors.ink] as const,
  /** Fallback only; the real mic gradient comes from useVoz() and is unique per person. */
  mic: ['#9A9A9A', '#4A4A4A', '#0A0A0A'] as const,
};

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const type = {
  title: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 36, letterSpacing: -1.1, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.2, color: colors.muted },
} as const;
