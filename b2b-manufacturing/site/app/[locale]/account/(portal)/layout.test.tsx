// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession, sessionMock } from '../../../../test/api-helpers';

const redirect = vi.hoisted(() => vi.fn());
const path: string | null = '/account/quotes?site=a';
vi.mock('@/i18n/routing', () => ({ redirect }));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => path }) }));
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current }));
const mustChange = vi.hoisted(() => vi.fn(async () => false));
vi.mock('@/lib/ct/team-password', () => ({ mustChangePassword: mustChange }));
vi.mock('@/components/portal/PortalShell', () => ({ PortalShell: () => null }));
const { default: Layout } = await import('./layout');
beforeEach(() => { mustChange.mockResolvedValue(false); redirect.mockReset(); redirect.mockImplementation((arg: unknown) => { throw new Error(`REDIRECT ${JSON.stringify(arg)}`); }); });

describe('malva-client-portal › Portal is private', () => {
  it('Signed out: redirects to sign-in with the locale-less return path', async () => {
    mockSession({});
    await expect(Layout({ children: null, params: Promise.resolve({ locale: 'de-DE' }) })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/account/sign-in?next=%2Faccount%2Fquotes%3Fsite%3Da', locale: 'de-DE' });
  });
  it('signed in: renders the shell with the first name, no redirect', async () => {
    mockSession({ customerId: 'c', customerFirstName: 'Dana' });
    const el = await Layout({ children: null, params: Promise.resolve({ locale: 'en-US' }) });
    expect((el as { props: { firstName: string } }).props.firstName).toBe('Dana');
    expect(redirect).not.toHaveBeenCalled();
  });
  it('malva-client-portal › Invite a user: a colleague who still has the one-time password is sent to choose their own', async () => {
    mockSession({ customerId: 'c', customerFirstName: 'New' });
    mustChange.mockResolvedValue(true);
    await expect(Layout({ children: null, params: Promise.resolve({ locale: 'en-US' }) })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/account/change-password', locale: 'en-US' });
  });
});
