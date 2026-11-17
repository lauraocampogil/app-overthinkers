import { Button, Capsule, Circle, HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  padding,
  strikethrough,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Home-screen / Lock Screen widget: the person's own mascot + what is left to do today.
 * Medium size lets you tick the next tasks without opening the app (iOS 17+).
 *
 * Runs in an isolated runtime: no hooks, no app imports, no module-level values.
 * Everything it shows (texts in the phone's language, the mascot's colours) comes in through props.
 */
export type WidgetTask = { id: string; title: string; done: boolean };
export type WidgetProps = {
  left: number;
  total: number;
  tasks: WidgetTask[];
  mascot: { core: string; mid: string; edge: string; eyeW: number; eyeH: number; gap: number };
  text: { left: string; none: string; allDone: string; empty: string };
};

const GetGoWidget = (props: WidgetProps, env: WidgetEnvironment) => {
  'widget';
  const ink = '#1F1A3D';
  const muted = '#6B6790';
  const accent = '#6A3FEF';
  const bg = {
    type: 'linearGradient' as const,
    colors: ['#FCE9F5', '#F4E8FF', '#E8DCFF'],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  };
  const m = props.mascot;

  const mascot = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size })]}>
      <Circle
        modifiers={[
          foregroundStyle({
            type: 'radialGradient',
            colors: [m.core, m.mid, m.edge],
            center: { x: 0.5, y: 0.58 },
            startRadius: 0,
            endRadius: size * 0.55,
          }),
        ]}
      />
      <Circle
        modifiers={[
          foregroundStyle({
            type: 'radialGradient',
            colors: ['#FFFFFFAA', '#FFFFFF00'],
            center: { x: 0.34, y: 0.26 },
            startRadius: 0,
            endRadius: size * 0.35,
          }),
        ]}
      />
      <HStack spacing={(m.gap * size) / 100}>
        <Capsule modifiers={[foregroundStyle('#FFFFFF'), frame({ width: (m.eyeW * size) / 100, height: (m.eyeH * size) / 100 })]} />
        <Capsule modifiers={[foregroundStyle('#FFFFFF'), frame({ width: (m.eyeW * size) / 100, height: (m.eyeH * size) / 100 })]} />
      </HStack>
    </ZStack>
  );

  const status = props.total === 0 ? props.text.empty : props.left === 0 ? props.text.allDone : props.text.left;

  // Lock Screen: just the count.
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <VStack modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        <Text modifiers={[font({ size: 22, weight: 'semibold' })]}>{String(props.left)}</Text>
      </VStack>
    );
  }
  if (env.widgetFamily === 'accessoryRectangular' || env.widgetFamily === 'accessoryInline') {
    const next = props.tasks.find((x) => !x.done);
    return (
      <VStack alignment="leading" modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>{status}</Text>
        {next ? <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{next.title}</Text> : null}
      </VStack>
    );
  }

  if (env.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" modifiers={[containerBackground(bg, 'widget'), widgetURL('getgo://')]}>
        {mascot(54)}
        <Spacer />
        <Text modifiers={[font({ size: 30, weight: 'semibold' }), foregroundStyle(ink)]}>{String(props.left)}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(2)]}>{status}</Text>
      </VStack>
    );
  }

  // Medium / large: mascot + the next tasks, tappable checkboxes.
  const shown = props.tasks.slice(0, env.widgetFamily === 'systemLarge' ? 7 : 3);
  return (
    <HStack spacing={14} modifiers={[containerBackground(bg, 'widget'), widgetURL('getgo://')]}>
      <VStack alignment="leading" spacing={6} modifiers={[frame({ width: 92 })]}>
        {mascot(66)}
        <Spacer />
        <Text modifiers={[font({ size: 26, weight: 'semibold' }), foregroundStyle(ink)]}>{String(props.left)}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(2)]}>{status}</Text>
      </VStack>
      <VStack alignment="leading" spacing={10}>
        {shown.length === 0 ? (
          <Text modifiers={[font({ size: 14 }), foregroundStyle(muted)]}>{props.text.none}</Text>
        ) : (
          shown.map((task) => (
            <Button
              key={task.id}
              target={`toggle:${task.id}`}
              onPress={() => {
                const tasks = props.tasks.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x));
                return { ...props, tasks, left: tasks.filter((x) => !x.done).length };
              }}
            >
              <HStack spacing={8}>
                <Circle
                  modifiers={[
                    foregroundStyle(task.done ? accent : '#FFFFFF'),
                    frame({ width: 18, height: 18 }),
                  ]}
                />
                <Text
                  modifiers={[
                    font({ size: 14, weight: 'medium' }),
                    foregroundStyle(task.done ? muted : ink),
                    strikethrough({ isActive: task.done, pattern: 'solid' }),
                    lineLimit(1),
                    opacity(task.done ? 0.7 : 1),
                  ]}
                >
                  {task.title}
                </Text>
              </HStack>
            </Button>
          ))
        )}
        <Spacer />
      </VStack>
    </HStack>
  );
};

export default createWidget<WidgetProps>('GetGoWidget', GetGoWidget, {
  left: 0,
  total: 0,
  tasks: [],
  mascot: { core: '#4A33B8', mid: '#7A5CE6', edge: '#B9A6FF', eyeW: 12, eyeH: 20, gap: 10 },
  text: { left: '', none: '', allDone: '', empty: 'GetGo' },
});
