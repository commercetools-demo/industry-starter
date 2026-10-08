// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated } from '@/test/api';
import { makeRequest } from '@/test/request';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const overview = vi.fn();
const { AccountGoneError } = vi.hoisted(() => ({ AccountGoneError: class extends Error {} }));
vi.mock('@/lib/ct/account-summary', () => ({ AccountGoneError, getOverview: (...a: unknown[]) => overview(...a) }));
const labs = { list: vi.fn(), detail: vi.fn(), own: vi.fn() };
vi.mock('@/lib/ct/account-labs', () => ({
  listLabs: (...a: unknown[]) => labs.list(...a),
  getLabDetail: (...a: unknown[]) => labs.detail(...a),
  getOwnLab: (...a: unknown[]) => labs.own(...a),
}));

import { GET as overviewRoute } from './overview/route';
import { GET as labsRoute } from './labs/route';
import { GET as labRoute } from './labs/[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  for (const fn of [overview, ...Object.values(labs)]) fn.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('account-dashboard: /api/account/overview', () => {
  it('Session no longer valid: 401 before any read', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated(overviewRoute, [overview]);
  });

  it('Session no longer valid: a customer that no longer exists answers 401 as well', async () => {
    overview.mockRejectedValue(new AccountGoneError());
    expect((await overviewRoute()).status).toBe(401);
  });

  it('answers the overview of the session customer (id never from the request)', async () => {
    overview.mockResolvedValue({ labs: { status: 'error' } });
    const response = await overviewRoute();
    expect(await response.json()).toEqual({ labs: { status: 'error' } });
    expect(overview).toHaveBeenCalledWith('c1');
  });
});

describe('design-account-area: lab routes', () => {
  it('signed out: 401 and no read', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated(labsRoute, [labs.list]);
    await expectUnauthenticated((r) => labRoute(r, ctx('LAB-1')), [labs.detail], makeRequest('/x'));
  });

  it('lists the session customer\'s labs', async () => {
    labs.list.mockResolvedValue([{ id: 'LAB-1' }]);
    expect(await (await labsRoute()).json()).toEqual({ labs: [{ id: 'LAB-1' }] });
    expect(labs.list).toHaveBeenCalledWith('c1');
  });

  it('Unknown or foreign test: the same 404 body and status for both', async () => {
    labs.detail.mockResolvedValue(null);
    const foreign = await labRoute(makeRequest('/x'), ctx('LAB-50301'));
    const unknown = await labRoute(makeRequest('/x'), ctx('l999'));
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual({ error: 'Not found.' });
    expect(await unknown.json()).toEqual({ error: 'Not found.' });
  });

  it('returns the detail of an own lab', async () => {
    labs.detail.mockResolvedValue({ id: 'LAB-1', results: [] });
    const response = await labRoute(makeRequest('/x'), ctx('LAB-1'));
    expect(response.status).toBe(200);
    expect(labs.detail).toHaveBeenCalledWith('c1', 'LAB-1');
  });
});
