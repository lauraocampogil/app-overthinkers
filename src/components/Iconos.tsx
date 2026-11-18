import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * GetGo's own line icons (no system emoji): 24×24, round caps, one stroke width,
 * same family as the streak flame. Colour and size come from props.
 */
type P = { color?: string; size?: number; strokeWidth?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const });
const line = (color: string, w: number) => ({ stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const CameraIcon = ({ color = colors.ink, size = 18, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" {...line(color, strokeWidth)} />
    <Circle cx={12} cy={12.5} r={3.4} {...line(color, strokeWidth)} />
  </Svg>
);

export const PinIcon = ({ color = colors.ink, size = 16, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" {...line(color, strokeWidth)} />
    <Circle cx={12} cy={10} r={2.3} {...line(color, strokeWidth)} />
  </Svg>
);

export const ClockIcon = ({ color = colors.ink, size = 16, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={8.5} {...line(color, strokeWidth)} />
    <Path d="M12 7.5V12l3 2" {...line(color, strokeWidth)} />
  </Svg>
);

export const SunIcon = ({ color = colors.ink, size = 20, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={4} {...line(color, strokeWidth)} />
    <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...line(color, strokeWidth)} />
  </Svg>
);

export const MoonIcon = ({ color = colors.ink, size = 20, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" {...line(color, strokeWidth)} />
  </Svg>
);

export const GearIcon = ({ color = colors.ink, size = 20, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={3} {...line(color, strokeWidth)} />
    <Path
      d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.3 3h-4.6l-.3 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.3 2.6h4.6l.3-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"
      {...line(color, strokeWidth)}
    />
  </Svg>
);

export const StarIcon = ({ color = colors.ink, size = 18, strokeWidth = 1.8, filled = false }: P & { filled?: boolean }) => (
  <Svg {...base(size)}>
    <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" {...line(color, strokeWidth)} fill={filled ? color : 'none'} />
  </Svg>
);

export const TargetIcon = ({ color = colors.ink, size = 16, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={8.5} {...line(color, strokeWidth)} />
    <Circle cx={12} cy={12} r={4.5} {...line(color, strokeWidth)} />
    <Circle cx={12} cy={12} r={0.8} fill={color} />
  </Svg>
);

export const CartIcon = ({ color = colors.ink, size = 18, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M3 4h2.2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6" {...line(color, strokeWidth)} />
    <Circle cx={9.5} cy={19.5} r={1.3} {...line(color, strokeWidth)} />
    <Circle cx={17} cy={19.5} r={1.3} {...line(color, strokeWidth)} />
  </Svg>
);

export const PlayIcon = ({ color = colors.white, size = 22 }: P) => (
  <Svg {...base(size)}>
    <Path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" fill={color} />
  </Svg>
);

export const LockIcon = ({ color = colors.ink, size = 18, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Rect x={5} y={10.5} width={14} height={10} rx={2.5} {...line(color, strokeWidth)} />
    <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...line(color, strokeWidth)} />
  </Svg>
);

export const CalendarIcon = ({ color = colors.ink, size = 18, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...line(color, strokeWidth)} />
    <Path d="M3.5 10h17M8 3v4M16 3v4" {...line(color, strokeWidth)} />
  </Svg>
);

export const MinusIcon = ({ color = colors.ink, size = 18, strokeWidth = 2 }: P) => (
  <Svg {...base(size)}>
    <Path d="M6 12h12" {...line(color, strokeWidth)} />
  </Svg>
);

export const PlusSmallIcon = ({ color = colors.ink, size = 18, strokeWidth = 2 }: P) => (
  <Svg {...base(size)}>
    <Path d="M12 6v12M6 12h12" {...line(color, strokeWidth)} />
  </Svg>
);

export const TrashIcon = ({ color = colors.danger, size = 18, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7" {...line(color, strokeWidth)} />
  </Svg>
);

export const ArrowRightIcon = ({ color = colors.ink, size = 16, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M5 12h14M13 6l6 6-6 6" {...line(color, strokeWidth)} />
  </Svg>
);

export const HomeIcon = ({ color = colors.ink, size = 22, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z" {...line(color, strokeWidth)} />
  </Svg>
);

export const ChartIcon = ({ color = colors.ink, size = 22, strokeWidth = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M5 20V12M10 20V6M15 20v-9M20 20V9" {...line(color, strokeWidth)} />
  </Svg>
);
