import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS } from './common-passwords';
import { checkPassword } from './password';
import { parseRegistration, safeNextPath } from './validation';

describe('malva-client-portal › Password rules', () => {
  it('refuses short and common passwords, naming the rule', () => {
    expect(checkPassword('short')).toBe('too-short');
    const common = [...COMMON_PASSWORDS].find((w) => w.length >= 10)!;
    expect(checkPassword(common)).toBe('too-common');
    expect(checkPassword(common.toUpperCase())).toBe('too-common');
    expect(COMMON_PASSWORDS.size).toBeGreaterThanOrEqual(1000);
    expect(checkPassword('correct-horse-9')).toBeNull();
  });
});
describe('malva-client-portal › Return path', () => {
  it('accepts same-site paths and rejects anything else', () => {
    expect(safeNextPath('/account/quotes?x=1')).toBe('/account/quotes?x=1');
    expect(safeNextPath('/en-US/account/quotes?x=1')).toBe('/account/quotes?x=1');
    expect(safeNextPath('/de-DE')).toBe('/');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined, 5, '/a\nb']) expect(safeNextPath(bad)).toBe('/account');
  });
});
describe('malva-client-portal › Abuse', () => {
  it('rejects disposable-looking input and bad fields', () => {
    const r = parseRegistration({ companyName: 'A', sector: 'x', firstName: '', lastName: 'L', email: 'a@mailinator.com', password: '' });
    expect(Object.keys(r.errors!).sort()).toEqual(['email', 'firstName', 'password', 'sector']);
    expect(parseRegistration({ companyName: 'A', sector: 'property', firstName: 'F', lastName: 'L', jobTitle: '', email: ' A@B.CO ', phone: '', password: 'x' }).input?.email).toBe('a@b.co');
  });
});

import { looksLikeBot, MIN_FILL_MS } from './bot-check';
describe('malva-client-portal › Abuse (bot signals)', () => {
  it('a filled honeypot, a missing start time and a too-fast submit are bots; a patient visitor is not', () => {
    const now = 1_000_000;
    expect(looksLikeBot({ website: 'http://spam', startedAt: now - 60_000 }, now)).toBe(true);
    expect(looksLikeBot({ website: '', startedAt: 0 }, now)).toBe(true);
    expect(looksLikeBot({ startedAt: now - (MIN_FILL_MS - 1) }, now)).toBe(true);
    expect(looksLikeBot({ startedAt: now + 5000 }, now)).toBe(true);
    expect(looksLikeBot({ website: '  ', startedAt: now - MIN_FILL_MS - 1 }, now)).toBe(false);
  });
});
