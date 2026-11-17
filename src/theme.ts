/** Palette: soft pink → lilac → purple, with a peach glow (same family as the voice screen). */
export const colors = {
  bgTop: '#FCE9F5',
  bgMid: '#F4E8FF',
  bgBottom: '#E8DCFF',
  pink: '#F49AC9',
  peach: '#FFB997',
  lilac: '#C77DFF',
  ink: '#1F1A3D',
  muted: '#6B6790',
  faint: '#A7A3C4',
  line: '#E4E0F5',
  soft: '#F5ECFF',
  accent: '#8A5CFF',
  accentDark: '#6A3FEF',
  accentLight: '#C27CFF',
  white: '#FFFFFF',
} as const;

export const gradients = {
  background: [colors.bgTop, colors.bgMid, colors.bgBottom] as const,
  action: [colors.accentLight, colors.accentDark] as const,
  mic: ['#F59ACB', '#B47CFF', '#7C4DFF'] as const,
};

export const fonts = {
  regular: 'InterTight_400Regular',
  medium: 'InterTight_500Medium',
  semibold: 'InterTight_600SemiBold',
} as const;

export const type = {
  title: { fontFamily: fonts.medium, fontSize: 34, lineHeight: 37, letterSpacing: -1, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.accent },
} as const;
