import { describe, expect, it } from 'vitest';

import { keepSaid, saidIn } from '../fiel';

describe('Okio never invents tasks', () => {
  const said = 'Mañana tengo que recoger a mi hermana a las 6 en el tren y tengo sesión de deporte a las 10 con MK';
  it('keeps what was said, in other words too', () => {
    expect(saidIn(said, 'Recoger a mi hermana')).toBe(true);
    expect(saidIn(said, 'Sesión de deporte con MK')).toBe(true);
    expect(saidIn('necesito huevos y leche', 'Hacer la compra', ['Huevos', 'Leche'])).toBe(true);
  });
  it('drops what was never said', () => {
    expect(saidIn(said, 'Ir a la cita')).toBe(false);
    expect(saidIn(said, 'Ver a Laura')).toBe(false);
    expect(keepSaid([{ title: 'Recoger a mi hermana' }, { title: 'Ver a Laura' }], said).map((x) => x.title)).toEqual(['Recoger a mi hermana']);
  });
});
