import { mascotTraits } from '../components/Mascota';
import { useMascot } from './auth';
import { bondLevel, useVinculo } from './vinculo';

/** The voice colours follow the mascot: grey on day one, its gradient once the bond has grown. */
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

export function voicePalette(seed: string, progress: number) {
  const p = mascotTraits(seed).palette;
  const mic = [p.a, p.mid, p.core].map((c, i) => mix(NEUTRAL_MIC[i], c, progress)) as [string, string, string];
  const clouds = [p.a, p.b, p.mid, p.edge, p.core].map((c, i) => mix(NEUTRAL_CLOUDS[i], c, progress));
  return { mic, clouds, solid: mic[1] };
}

export function useVoz() {
  const m = useMascot();
  const points = useVinculo((s) => s.points);
  return voicePalette(m.seed, bondLevel(points));
}
