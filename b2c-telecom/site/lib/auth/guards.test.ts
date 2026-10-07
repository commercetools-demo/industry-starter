const getSession = vi.fn();
const redirect = vi.fn((arg: unknown) => {
  throw new Error(`REDIRECT ${JSON.stringify(arg)}`);
});
vi.mock('@/lib/ct/session', () => ({ getSession: () => getSession() }));
vi.mock('@/i18n/routing', () => ({ redirect: (arg: unknown) => redirect(arg) }));

import { loginUrl, requireSession, sanitizeNext, unauthorizedUrl } from './guards';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireSession', () => {
  it('Expired session is not a refusal: no session redirects to sign-in with the destination preserved, not to unauthorized', async () => {
    getSession.mockResolvedValue({});
    await expect(requireSession('en-US', '/account/orders')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith({ href: '/login?next=%2Faccount%2Forders', locale: 'en-US' });
    expect(JSON.stringify(redirect.mock.calls)).not.toContain('unauthorized');
  });

  it('an anonymous session (cart but no customer) is also sent to sign-in', async () => {
    getSession.mockResolvedValue({ anonymousId: 'a', cartId: 'c' });
    await expect(requireSession('de-DE', '/account')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/login?next=%2Faccount', locale: 'de-DE' });
  });

  it('a signed-in session returns the customer id and does not redirect', async () => {
    getSession.mockResolvedValue({ customerId: 'cust-1' });
    await expect(requireSession('en-US', '/account')).resolves.toEqual({ customerId: 'cust-1' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('an unsafe destination falls back to /account', async () => {
    getSession.mockResolvedValue({});
    await expect(requireSession('en-US', '//evil.com')).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/login?next=%2Faccount', locale: 'en-US' });
  });
});

describe('sanitizeNext', () => {
  it('keeps a same-site path with its query', () => {
    expect(sanitizeNext('/account/orders?page=2')).toBe('/account/orders?page=2');
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute url', 'https://x'],
    ['backslash trick', '/\\x'],
    ['backslash anywhere', '/a\\b'],
    ['control character', '/a\nb'],
    ['nul', '/a\u0000b'],
    ['no leading slash', 'account'],
    ['empty', ''],
    ['too long', `/${'a'.repeat(512)}`],
    ['javascript scheme', 'javascript:alert(1)'],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeNext(value)).toBe('/account');
  });

  it('null and undefined give the default', () => {
    expect(sanitizeNext(null)).toBe('/account');
    expect(sanitizeNext(undefined)).toBe('/account');
  });

  it('exactly 512 characters is accepted', () => {
    const path = `/${'a'.repeat(511)}`;
    expect(sanitizeNext(path)).toBe(path);
  });
});

describe('urls', () => {
  it('loginUrl encodes the destination', () => {
    expect(loginUrl('en-US', '/account/orders')).toBe('/en-US/login?next=%2Faccount%2Forders');
  });

  it('unauthorizedUrl adds ref only when it matches the safe pattern', () => {
    expect(unauthorizedUrl('en-US')).toBe('/en-US/unauthorized');
    expect(unauthorizedUrl('de-DE', 'AB12-CD34')).toBe('/de-DE/unauthorized?ref=AB12-CD34');
    expect(unauthorizedUrl('en-US', '<script>')).toBe('/en-US/unauthorized');
    expect(unauthorizedUrl('en-US', 'abc')).toBe('/en-US/unauthorized');
  });
});
