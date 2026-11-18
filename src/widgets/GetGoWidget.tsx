import { Button, Capsule, Circle, HStack, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  strikethrough,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Home-screen / Lock Screen widget. Black and white like the app; the only colour is the person's mascot.
 * It shows "Lo más importante": today's 3 priorities, tickable from the widget (iOS 17+).
 * A task that needs a photo opens the camera in the app instead of ticking.
 *
 * Runs in an isolated runtime: no hooks, no app imports, no module-level values.
 * Everything it shows (texts in the phone's language, the mascot's colours) comes in through props.
 */
export type WidgetTask = { id: string; title: string; done: boolean; proof?: boolean; time?: string };
export type WidgetProps = {
  left: number;
  total: number;
  /** Today's 3 priorities. */
  top: WidgetTask[];
  /** Everything else for today, for the large size and the lock screen. */
  tasks: WidgetTask[];
  mascot: { core: string; mid: string; edge: string; eyeW: number; eyeH: number; gap: number };
  text: { left: string; none: string; allDone: string; empty: string; top: string; then: string };
};

const GetGoWidget = (props: WidgetProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#FFFFFF' : '#0A0A0A';
  const muted = dark ? '#9A9A9A' : '#6E6E6E';
  const line = dark ? '#3A3A3A' : '#D6D6D6';
  const bg = dark ? '#0A0A0A' : '#FFFFFF';
  const m = props.mascot;
  const top = props.top ?? [];
  const topDone = top.filter((x) => x.done).length;

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

  const row = (task: WidgetTask, n: number, size: number) => {
    const body = (
      <HStack spacing={10}>
        <ZStack modifiers={[frame({ width: size + 4, height: size + 4 })]}>
          <Circle modifiers={[foregroundStyle(task.done ? ink : line)]} />
          <Text modifiers={[font({ size: size * 0.55, weight: 'bold' }), foregroundStyle(task.done ? bg : ink)]}>
            {task.done ? '✓' : String(n)}
          </Text>
        </ZStack>
        <VStack alignment="leading" spacing={1}>
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold' }),
              foregroundStyle(task.done ? muted : ink),
              strikethrough({ isActive: task.done, pattern: 'solid' }),
              lineLimit(1),
            ]}
          >
            {task.title}
          </Text>
          {task.time || task.proof ? (
            <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(muted), lineLimit(1)]}>
              {[task.time ?? '', task.proof && !task.done ? '📷' : ''].filter(Boolean).join('  ')}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
      </HStack>
    );
    if (task.proof && !task.done) {
      return (
        <Link key={task.id} destination={`getgo://prueba?id=${task.id}`}>
          {body}
        </Link>
      );
    }
    return (
      <Button
        key={task.id}
        target={`toggle:${task.id}`}
        onPress={() => {
          const flip = (x: WidgetTask) => (x.id === task.id ? { ...x, done: !x.done } : x);
          const tasks = props.tasks.map(flip);
          const nextTop = top.map(flip);
          return { ...props, top: nextTop, tasks, left: [...nextTop, ...tasks].filter((x) => !x.done).length };
        }}
      >
        {body}
      </Button>
    );
  };

  const header = (
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(muted)]}>{props.text.top.toUpperCase()}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink)]}>{`${topDone}/${top.length || 3}`}</Text>
    </HStack>
  );

  const status = props.total === 0 ? props.text.empty : props.left === 0 ? props.text.allDone : props.text.left;
  const firstOpen = top.find((x) => !x.done) ?? props.tasks.find((x) => !x.done);

  // Lock Screen
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <VStack modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        <Text modifiers={[font({ size: 20, weight: 'bold' })]}>{`${topDone}/${top.length || 3}`}</Text>
      </VStack>
    );
  }
  if (env.widgetFamily === 'accessoryInline') {
    return (
      <Text modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        {firstOpen ? firstOpen.title : status}
      </Text>
    );
  }
  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), opacity(0.7)]}>{`${props.text.top} · ${topDone}/${top.length || 3}`}</Text>
        {top.slice(0, 2).map((x) => (
          <Text key={x.id} modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(1), strikethrough({ isActive: x.done, pattern: 'solid' })]}>
            {x.title}
          </Text>
        ))}
      </VStack>
    );
  }

  // Small: the mascot and the one thing to do now.
  if (env.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[containerBackground(bg, 'widget'), widgetURL(firstOpen ? `getgo://foco?id=${firstOpen.id}` : 'getgo://')]}>
        <HStack>
          {mascot(40)}
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ink)]}>{`${topDone}/${top.length || 3}`}</Text>
        </HStack>
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(muted)]}>{props.text.top.toUpperCase()}</Text>
        <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(ink), lineLimit(3)]}>
          {firstOpen ? firstOpen.title : status}
        </Text>
      </VStack>
    );
  }

  // Medium: mascot + the 3 priorities.
  if (env.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[containerBackground(bg, 'widget'), widgetURL('getgo://')]}>
        <VStack alignment="leading" modifiers={[frame({ width: 64 })]}>
          {mascot(56)}
          <Spacer />
          <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(ink)]}>{String(props.left)}</Text>
          <Text modifiers={[font({ size: 11 }), foregroundStyle(muted), lineLimit(2)]}>{status}</Text>
        </VStack>
        <VStack alignment="leading" spacing={9}>
          {header}
          {top.length ? top.map((x, i) => row(x, i + 1, 18)) : <Text modifiers={[font({ size: 14 }), foregroundStyle(muted)]}>{props.text.none}</Text>}
          <Spacer />
        </VStack>
      </HStack>
    );
  }

  // Large: the 3 priorities, then what else is on today.
  const rest = props.tasks.filter((x) => !top.some((y) => y.id === x.id)).slice(0, 4);
  return (
    <VStack alignment="leading" spacing={10} modifiers={[containerBackground(bg, 'widget'), widgetURL('getgo://')]}>
      <HStack>
        {mascot(44)}
        <Spacer />
        <VStack alignment="trailing" spacing={0}>
          <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(ink)]}>{String(props.left)}</Text>
          <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>{status}</Text>
        </VStack>
      </HStack>
      {header}
      {top.length ? top.map((x, i) => row(x, i + 1, 20)) : <Text modifiers={[font({ size: 14 }), foregroundStyle(muted)]}>{props.text.none}</Text>}
      {rest.length ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(muted)]}>{props.text.then.toUpperCase()}</Text> : null}
      {rest.map((x) => (
        <Text key={x.id} modifiers={[font({ size: 14 }), foregroundStyle(x.done ? muted : ink), lineLimit(1), strikethrough({ isActive: x.done, pattern: 'solid' })]}>
          {`·  ${x.title}`}
        </Text>
      ))}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetProps>('GetGoWidget', GetGoWidget, {
  left: 0,
  total: 0,
  top: [],
  tasks: [],
  mascot: { core: '#2E2E2E', mid: '#6E6E6E', edge: '#BDBDBD', eyeW: 12, eyeH: 20, gap: 10 },
  text: { left: '', none: '', allDone: '', empty: 'GetGo', top: 'Lo más importante', then: 'Después' },
});
