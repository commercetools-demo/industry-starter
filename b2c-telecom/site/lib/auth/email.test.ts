import { isPlausibleEmail, normalizeEmail } from './email';

describe('email helpers', () => {
  it('normalizes by trimming and lower-casing', () => {
    expect(normalizeEmail('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
  });

  it('accepts plausible addresses', () => {
    expect(isPlausibleEmail('a@b.co')).toBe(true);
    expect(isPlausibleEmail('jane.doe+tag@example.com')).toBe(true);
  });

  it('rejects implausible addresses', () => {
    for (const value of ['', 'nobody', 'a@b', 'a@b.c', 'a b@c.de', '@x.de', 'a@@x.de']) expect(isPlausibleEmail(value)).toBe(false);
  });

  it('rejects an address longer than 254 characters', () => {
    expect(isPlausibleEmail(`${'a'.repeat(250)}@b.de`)).toBe(false);
    expect(isPlausibleEmail(`${'a'.repeat(240)}@b.de`)).toBe(true);
  });
});
