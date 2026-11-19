import { describe, expect, it } from 'vitest';

import { emailIn, mailtoUrl, phoneIn, stepKindOf } from '../primer-paso';

describe('primer paso', () => {
  it('finds emails, messages and calls in several languages', () => {
    expect(stepKindOf('Enviar mail al profe de mates')).toBe('email');
    expect(stepKindOf('Envoyer un courriel à la banque')).toBe('email');
    expect(stepKindOf('Llamar al dentista')).toBe('call');
    expect(stepKindOf('Appeler maman')).toBe('call');
    expect(stepKindOf('Mandar un whatsapp a Lucía')).toBe('message');
    expect(stepKindOf('Escribir a Marta para quedar')).toBe('message');
    expect(stepKindOf('Estudiar historia')).toBeNull();
    expect(stepKindOf('Écrire le mémoire')).toBeNull();
  });
  it('reads an address and a number from the task', () => {
    expect(emailIn('mail a ana@uni.be sobre el examen')).toBe('ana@uni.be');
    expect(phoneIn('llamar al +32 470 12 34 56')).toBe('+32470123456');
    expect(phoneIn('llamar a mamá')).toBeNull();
  });
  it('builds a mailto link the mail app opens with the draft', () => {
    expect(mailtoUrl('a@b.be', 'Hola', 'Qué tal')).toBe('mailto:a@b.be?subject=Hola&body=Qu%C3%A9%20tal');
  });
});
