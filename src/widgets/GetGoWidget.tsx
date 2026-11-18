import { Button, Capsule, Circle, Gauge, HStack, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  clipped,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  offset,
  tint,
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
  /** Small stats under the ring, like a fitness widget: done today, focus minutes, streak. */
  stats?: { done: number; focus: number; streak: number };
  text: {
    left: string;
    none: string;
    allDone: string;
    empty: string;
    top: string;
    then: string;
    pending?: string;
    done?: string;
    focus?: string;
    streak?: string;
    next?: string;
  };
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

  const done = props.total - props.left;
  const progress = props.total ? done / props.total : 0;
  const pendingWord = props.text.pending ?? '';
  const stats = props.stats ?? { done, focus: 0, streak: 0 };

  // The ring with the number of tasks still to do in the middle (like a calories-left ring).
  const ring = (size: number, label: string = String(props.left)) => (
    <Gauge
      value={progress}
      modifiers={[gaugeStyle('circularCapacity'), tint({ type: 'linearGradient', colors: [m.edge, m.mid, m.core], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }), frame({ width: size, height: size })]}
      currentValueLabel={<Text modifiers={[font({ size: size * (label.length > 2 ? 0.24 : 0.34), weight: 'bold' }), monospacedDigit()]}>{label}</Text>}
    />
  );

  // Lock Screen: how many tasks are left, at a glance.
  if (env.widgetFamily === 'accessoryCircular') {
    return (
      <Gauge
        value={progress}
        modifiers={[gaugeStyle('circularCapacity'), containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}
        currentValueLabel={<Text modifiers={[font({ size: 18, weight: 'bold' }), monospacedDigit()]}>{String(props.left)}</Text>}
      />
    );
  }
  if (env.widgetFamily === 'accessoryInline') {
    return (
      <Text modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        {props.left ? `${props.left} ${pendingWord}${firstOpen ? ` · ${firstOpen.title}` : ''}` : status}
      </Text>
    );
  }
  if (env.widgetFamily === 'accessoryRectangular') {
    return (
      <HStack spacing={8} modifiers={[containerBackground('#00000000', 'widget'), widgetURL('getgo://')]}>
        <Gauge
          value={progress}
          modifiers={[gaugeStyle('circularCapacity'), frame({ width: 44, height: 44 })]}
          currentValueLabel={<Text modifiers={[font({ size: 15, weight: 'bold' }), monospacedDigit()]}>{String(props.left)}</Text>}
        />
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 15, weight: 'bold' })]}>{props.left ? `${props.left} ${pendingWord}` : status}</Text>
          {firstOpen ? (
            <Text modifiers={[font({ size: 12, weight: 'medium' }), opacity(0.75), lineLimit(1)]}>{`${props.text.next ?? ''} ${firstOpen.title}`.trim()}</Text>
          ) : null}
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // Small: the mascot peeking from the corner and the ring.
  if (env.widgetFamily === 'systemSmall') {
    return (
      <ZStack modifiers={[containerBackground(bg, 'widget'), widgetURL(firstOpen ? `getgo://foco?id=${firstOpen.id}` : 'getgo://')]}>
        <VStack alignment="leading" spacing={4}>
          <HStack>
            {ring(64)}
            <Spacer />
          </HStack>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(muted)]}>{props.left ? pendingWord : status}</Text>
          <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(ink), lineLimit(2)]}>{firstOpen ? firstOpen.title : ''}</Text>
        </VStack>
        <VStack alignment="trailing">
          <HStack>
            <Spacer />
            <ZStack modifiers={[offset({ x: 22, y: -18 })]}>{mascot(70)}</ZStack>
          </HStack>
          <Spacer />
        </VStack>
      </ZStack>
    );
  }

  // Medium, like the reference: the mascot peeking on the left, the ring with what's left, small stats below.
  if (env.widgetFamily === 'systemMedium') {
    const stat = (value: string, label: string) => (
      <VStack spacing={0}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(ink), monospacedDigit()]}>{value}</Text>
        <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(muted)]}>{label}</Text>
      </VStack>
    );
    return (
      <HStack spacing={0} modifiers={[containerBackground(bg, 'widget'), widgetURL('getgo://')]}>
        <ZStack modifiers={[frame({ width: 120 }), clipped()]}>
          <ZStack modifiers={[offset({ x: -18, y: 34 })]}>{mascot(150)}</ZStack>
        </ZStack>
        <VStack alignment="leading" spacing={8}>
          <HStack spacing={10}>
            {ring(62, `${done}/${props.total}`)}
            <VStack alignment="leading" spacing={0}>
              <Text modifiers={[font({ size: 34, weight: 'heavy' }), foregroundStyle(ink), monospacedDigit()]}>{String(props.left)}</Text>
              <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(muted), lineLimit(1)]}>{props.left ? pendingWord : status}</Text>
            </VStack>
          </HStack>
          <HStack spacing={14}>
            {stat(String(stats.done), props.text.done ?? '')}
            {stat(`${stats.focus}′`, props.text.focus ?? '')}
            {stat(String(stats.streak), props.text.streak ?? '')}
          </HStack>
        </VStack>
        <Spacer />
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
  text: { left: '', none: '', allDone: '', empty: 'Okio', top: 'Lo más importante', then: 'Después' },
});
