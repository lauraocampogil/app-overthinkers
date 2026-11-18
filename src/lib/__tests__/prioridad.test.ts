import { describe, expect, it } from 'vitest';

import { requiresProof, topThree } from '../prioridad';
import type { Task } from '../types';

const TODAY = '2026-11-18';
let n = 0;
const task = (patch: Partial<Task>): Task => ({
  id: `t${n++}`,
  title: 'x',
  minutes: null,
  due: null,
  energy: 'baja',
  kind: 'otro',
  importance: 2,
  sport: null,
  checklist: [],
  goalId: null,
  where: null,
  at: null,
  day: TODAY,
  pinned: false,
  postponed: 0,
  status: 'pendiente',
  why: [],
  ...patch,
});

describe('top 3', () => {
  it('keeps only 3 and puts starred tasks first', () => {
    const a = task({ importance: 3, due: TODAY });
    const b = task({ importance: 1 });
    const c = task({ importance: 2, top: true });
    const d = task({ importance: 2 });
    const e = task({ importance: 3 });
    const top = topThree([a, b, c, d, e], TODAY);
    expect(top).toHaveLength(3);
    expect(top[0].id).toBe(c.id);
    expect(top.map((x) => x.id)).toEqual([c.id, a.id, e.id]);
  });

  it('ignores done tasks', () => {
    const a = task({ status: 'hecha' });
    const b = task({});
    expect(topThree([a, b], TODAY).map((x) => x.id)).toEqual([b.id]);
  });

  it('postponed tasks climb up', () => {
    const fresh = task({ importance: 2 });
    const pushed = task({ importance: 2, postponed: 3 });
    expect(topThree([fresh, pushed], TODAY)[0].id).toBe(pushed.id);
  });
});

describe('proof', () => {
  it('needs a photo until one is attached', () => {
    expect(requiresProof(task({ needsProof: true }))).toBe(true);
    expect(requiresProof(task({ needsProof: true, proofPhoto: 'file://x.jpg' }))).toBe(false);
    expect(requiresProof(task({ needsProof: false }))).toBe(false);
  });
});
