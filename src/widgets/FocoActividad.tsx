import { Capsule, Circle, HStack, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/**
 * Focus session on the Lock Screen and in the Dynamic Island: the task, the time left counting down,
 * and the person's mascot colours. Started / paused / ended from the focus screen (app/foco.tsx).
 * Runs in an isolated runtime like the widget: everything comes in through props.
 */
export type FocoProps = {
  title: string;
  /** Epoch ms. While paused, `pausedAt` freezes the timer. */
  startedAt: number;
  endsAt: number;
  pausedAt?: number | null;
  color: string;
  colorSoft: string;
  label: string;
  pausedLabel: string;
};

const FocoActividad = (props: FocoProps, env: LiveActivityEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#FFFFFF' : '#0A0A0A';
  const muted = dark ? '#A0A0A0' : '#6E6E6E';
  const range = { lower: new Date(props.startedAt), upper: new Date(props.endsAt) };
  const paused = props.pausedAt ? new Date(props.pausedAt) : undefined;

  const dot = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size })]}>
      <Circle
        modifiers={[
          foregroundStyle({
            type: 'radialGradient',
            colors: [props.color, props.colorSoft],
            center: { x: 0.5, y: 0.55 },
            startRadius: 0,
            endRadius: size * 0.6,
          }),
        ]}
      />
      <HStack spacing={size * 0.12}>
        <Capsule modifiers={[foregroundStyle('#FFFFFF'), frame({ width: size * 0.11, height: size * 0.2 })]} />
        <Capsule modifiers={[foregroundStyle('#FFFFFF'), frame({ width: size * 0.11, height: size * 0.2 })]} />
      </HStack>
    </ZStack>
  );

  const timer = (size: number, color: string) => (
    <Text
      timerInterval={range}
      countsDown
      pauseTime={paused}
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit(), foregroundStyle(color)]}
    />
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 16, vertical: 14 })]}>
        <HStack spacing={12}>
          {dot(36)}
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(muted)]}>
              {(props.pausedAt ? props.pausedLabel : props.label).toUpperCase()}
            </Text>
            <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{props.title}</Text>
          </VStack>
          <Spacer />
          {timer(28, ink)}
        </HStack>
        <ProgressView timerInterval={range} countsDown={false} modifiers={[tint(props.color)]} />
      </VStack>
    ),
    compactLeading: dot(22),
    compactTrailing: timer(14, props.colorSoft),
    minimal: dot(20),
    expandedLeading: dot(40),
    expandedCenter: (
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
    ),
    expandedTrailing: timer(22, '#FFFFFF'),
    expandedBottom: <ProgressView timerInterval={range} countsDown={false} modifiers={[tint(props.colorSoft)]} />,
  };
};

export default createLiveActivity<FocoProps>('FocoActividad', FocoActividad);
