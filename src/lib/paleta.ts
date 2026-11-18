import { mascotTraits } from '../components/Mascota';
import { MASCOT_AFTER_DAYS, useMascot } from './auth';

/**
 * The voice colours are the person's own: they start grey and, day by day,
 * blend into their mascot's gradient. On the day the mascot appears they match it exactly.
 */
const NEUTRAL_MIC = ['#B5B5B5', '#5C5C5C', '#111111'];
const NEUTRAL_CLOUDS = ['#D0D0D0', '#9E9E9E', '#6A6A6A', '#BDBDBD', '#2E2E2E'];

const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function mix(a: string, b: string, t: number) {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** 0 on the first day, 1 once the mascot is there. Eased so the change is visible early. */
export function voiceProgress(days: number, unlocked: boolean) {
  if (unlocked) return 1;
  const p = Math.max(0, Math.min(1, days / MASCOT_AFTER_DAYS));
  return 0.12 + 0.88 * Math.sqrt(p);
}

export function voicePalette(seed: string, progress: number) {
  const p = mascotTraits(seed).palette;
  const mic = [p.a, p.mid, p.core].map((c, i) => mix(NEUTRAL_MIC[i], c, progress)) as [string, string, string];
  const clouds = [p.a, p.b, p.mid, p.edge, p.core].map((c, i) => mix(NEUTRAL_CLOUDS[i], c, progress));
  return { mic, clouds, solid: mic[1] };
}

export function useVoz() {
  const m = useMascot();
  return voicePalette(m.seed, voiceProgress(m.days, m.unlocked));
}
