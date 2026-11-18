import { describe, expect, it } from 'vitest';

import { parseDuration } from '../tiempo';

describe('parseDuration', () => {
  it.each([
    ['media hora', 30],
    ['45 minutos', 45],
    ['una hora', 60],
    ['una hora y media', 90],
    ['hora y media', 90],
    ['dos horas', 120],
    ['1h30', 90],
    ['un cuarto de hora', 15],
    ['cuarenta', 40],
    ['20 min', 20],
    ['half an hour', 30],
    ['an hour and a half', 90],
    ['une heure', 60],
    ['een uur', 60],
    ['eh pues como media hora más o menos', 30],
  ])('%s → %i', (text, minutes) => expect(parseDuration(text)).toBe(minutes));
  it('null when nothing', () => expect(parseDuration('no sé')).toBeNull());
});
