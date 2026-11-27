import { describe, expect, it } from 'vitest';
import { pinFromQr } from '../src/app/qrPin';

describe('QR приглашения → PIN', () => {
  it('ссылка из лобби', () => expect(pinFromQr('https://bekzaty.abmco.kz/catan/?pin=965326')).toBe('965326'));
  it('ссылка для ТВ', () => expect(pinFromQr('https://bekzaty.abmco.kz/catan/?pin=123456&tv=1')).toBe('123456'));
  it('просто 6 цифр', () => expect(pinFromQr('PIN 654321')).toBe('654321'));
  it('чужой QR', () => expect(pinFromQr('https://example.com/menu')).toBeNull());
});
