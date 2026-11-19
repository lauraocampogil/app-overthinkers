import { describe, expect, it } from 'vitest';



import { timeInTitle } from '../hora';

describe('hour said inside the title', () => {
  it('moves it to the hour and out of the title', () => {
    expect(timeInTitle('Recoger a mi hermana a las 6')).toEqual({ title: 'Recoger a mi hermana', at: '18:00' });
    expect(timeInTitle('Recoger a mi hermana a las 18h')).toEqual({ title: 'Recoger a mi hermana', at: '18:00' });
    expect(timeInTitle('Dentiste à 9h30')).toEqual({ title: 'Dentiste', at: '09:30' });
    expect(timeInTitle('Correr a las 7 de la mañana')).toEqual({ title: 'Correr', at: '07:00' });
    expect(timeInTitle('Call mum at 6pm')).toEqual({ title: 'Call mum', at: '18:00' });
    expect(timeInTitle('Leer 20 páginas')).toBeNull();
  });
});
