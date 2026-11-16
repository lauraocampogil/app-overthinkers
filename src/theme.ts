export const colors = {
  bgTop: '#FAF9FF',
  bgBottom: '#F0EDFF',
  ink: '#1F1A3D',
  muted: '#6B6790',
  faint: '#A7A3C4',
  line: '#E4E0F5',
  soft: '#F2F0FF',
  accent: '#6E5BFF',
  accentDark: '#5A44F2',
  accentLight: '#8B7BFF',
  white: '#FFFFFF',
} as const;

export const gradients = {
  background: [colors.bgTop, colors.bgBottom] as const,
  action: [colors.accentLight, colors.accentDark] as const,
  mic: ['#A98BFF', '#7C4DFF', '#5B2FE6'] as const,
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
