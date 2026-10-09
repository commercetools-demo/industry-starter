// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoBusinessUnit, expectSanitizedError, expectUnauthenticated, mockSession, sessionMock } from '../../test/api-helpers';

const m = vi.hoisted(() => ({ listThreads: vi.fn(), getThread: vi.fn(), actOnQuote: vi.fn(), cancelRequest: vi.fn(), listSites: vi.fn(), addSite: vi.fn(), updateSite: vi.fn(), removeSite: vi.fn(), setDefaultSite: vi.fn(), listTeam: vi.fn(), inviteColleague: vi.fn(), changeRole: vi.fn(), removeColleague: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current, saveSession: vi.fn() }));
vi.mock('@/lib/ct/portal-quotes', () => ({ listThreads: m.listThreads, getThread: m.getThread, actOnQuote: m.actOnQuote, cancelRequest: m.cancelRequest }));
vi.mock('@/lib/ct/sites', () => ({ listSites: m.listSites, addSite: m.addSite, updateSite: m.updateSite, removeSite: m.removeSite, setDefaultSite: m.setDefaultSite }));
vi.mock('@/lib/ct/team', () => ({ listTeam: m.listTeam, inviteColleague: m.inviteColleague, changeRole: m.changeRole, removeColleague: m.removeColleague }));

const quotes = await import('./quotes/route');
const quote = await import('./quotes/[id]/route');
const accept = await import('./quotes/[id]/accept/route');
const decline = await import('./quotes/[id]/decline/route');
const renegotiate = await import('./quotes/[id]/renegotiate/route');
const cancel = await import('./quote-requests/[id]/cancel/route');
const sites = await import('./sites/route');
const site = await import('./sites/[key]/route');
const siteDefault = await import('./sites/[key]/default/route');
const team = await import('./team/route');
const member = await import('./team/[customerId]/route');
const { ApiError } = await import('@/lib/api');

const post = (body?: unknown) => new Request('http://x/api', { method: 'POST', body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const siteBody = { name: 'Yard', streetName: '9 Yard Way', city: 'Akron', postalCode: '44301', country: 'US' };

beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); mockSession({ customerId: 'c1', businessUnitKey: 'bu' }); });

describe('malva-client-portal › Quotes and requests › routes', () => {
  const all: Array<[string, () => Promise<Response>, ReturnType<typeof vi.fn>]> = [
    ['GET /api/quotes', () => quotes.GET(), m.listThreads],
    ['GET /api/quotes/[id]', () => quote.GET(post(), ctx({ id: 'r1' })), m.getThread],
    ['accept', () => accept.POST(post(), ctx({ id: 'q1' })), m.actOnQuote],
    ['decline', () => decline.POST(post(), ctx({ id: 'q1' })), m.actOnQuote],
    ['renegotiate', () => renegotiate.POST(post({ comment: 'hi' }), ctx({ id: 'q1' })), m.actOnQuote],
    ['cancel', () => cancel.POST(post(), ctx({ id: 'r1' })), m.cancelRequest],
  ];
  it.each(all)('%s: 401 without a customer, 400 without a business unit, sanitized errors', async (_n, call, spy) => {
    await expectUnauthenticated(call as never, spy);
    await expectNoBusinessUnit(call as never, spy);
    spy.mockRejectedValue(new Error('SDK-INTERNAL secret token'));
    await expectSanitizedError(call as never);
  });
  it('passes the id and the action; the thread comes back', async () => {
    m.actOnQuote.mockResolvedValue({ id: 'r1' });
    expect(await (await accept.POST(post(), ctx({ id: 'q1' }))).json()).toEqual({ thread: { id: 'r1' } });
    expect(m.actOnQuote).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1' }), 'q1', 'accept');
    await decline.POST(post(), ctx({ id: 'q1' }));
    expect(m.actOnQuote).toHaveBeenLastCalledWith(expect.anything(), 'q1', 'decline');
  });
  it('renegotiate needs a comment (400 with the sentence), otherwise passes it on', async () => {
    const res = await renegotiate.POST(post({ comment: '  ' }), ctx({ id: 'q1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('question');
    expect((await renegotiate.POST(post('not json'), ctx({ id: 'q1' }))).status).toBe(400);
    expect(m.actOnQuote).not.toHaveBeenCalled();
    m.actOnQuote.mockResolvedValue({});
    await renegotiate.POST(post({ comment: ' Why? ' }), ctx({ id: 'q1' }));
    expect(m.actOnQuote).toHaveBeenCalledWith(expect.anything(), 'q1', 'renegotiate', 'Why?');
  });
  it('404 and 403 from the module are passed on with their sentences', async () => {
    m.getThread.mockRejectedValue(new ApiError(404, 'Not found.'));
    expect((await quote.GET(post(), ctx({ id: 'x' }))).status).toBe(404);
    m.actOnQuote.mockRejectedValue(new ApiError(403, 'You do not have permission to do this.'));
    expect((await accept.POST(post(), ctx({ id: 'q1' }))).status).toBe(403);
  });
});

describe('malva-client-portal › Sites and team › routes', () => {
  const all: Array<[string, () => Promise<Response>, ReturnType<typeof vi.fn>]> = [
    ['GET /api/sites', () => sites.GET(), m.listSites],
    ['POST /api/sites', () => sites.POST(post(siteBody)), m.addSite],
    ['PATCH /api/sites/[key]', () => site.PATCH(post(siteBody), ctx({ key: 's' })), m.updateSite],
    ['DELETE /api/sites/[key]', () => site.DELETE(post(), ctx({ key: 's' })), m.removeSite],
    ['POST default', () => siteDefault.POST(post(), ctx({ key: 's' })), m.setDefaultSite],
    ['GET /api/team', () => team.GET(), m.listTeam],
    ['POST /api/team', () => team.POST(post({ firstName: 'A', lastName: 'B', email: 'a@b.co', roleKey: 'mpw-finance' })), m.inviteColleague],
    ['PATCH /api/team/[id]', () => member.PATCH(post({ roleKey: 'mpw-admin' }), ctx({ customerId: 'x' })), m.changeRole],
    ['DELETE /api/team/[id]', () => member.DELETE(post(), ctx({ customerId: 'x' })), m.removeColleague],
  ];
  it.each(all)('%s: 401, 400 without a business unit, sanitized errors', async (_n, call, spy) => {
    await expectUnauthenticated(call as never, spy);
    await expectNoBusinessUnit(call as never, spy);
    spy.mockRejectedValue(new Error('SDK-INTERNAL secret token'));
    await expectSanitizedError(call as never);
  });
  it('refused without UpdateBusinessUnitDetails / UpdateAssociates: the module\'s 403 reaches the client', async () => {
    m.addSite.mockRejectedValue(new ApiError(403, 'You do not have permission to do this.'));
    m.inviteColleague.mockRejectedValue(new ApiError(403, 'You do not have permission to do this.'));
    expect((await sites.POST(post(siteBody))).status).toBe(403);
    expect((await team.POST(post({ firstName: 'A', lastName: 'B', email: 'a@b.co', roleKey: 'mpw-finance' }))).status).toBe(403);
  });
  it('invalid bodies are 400 with the sentence and reach no commercetools call', async () => {
    expect((await (await sites.POST(post({ ...siteBody, city: '' }))).json()).error).toBe('Enter the city.');
    expect((await site.PATCH(post('nope'), ctx({ key: 's' }))).status).toBe(400);
    expect((await team.POST(post({ firstName: 'A', lastName: 'B', email: 'bad', roleKey: 'mpw-finance' }))).status).toBe(400);
    expect((await member.PATCH(post({ roleKey: 'boss' }), ctx({ customerId: 'x' }))).status).toBe(400);
    expect([m.addSite, m.updateSite, m.inviteColleague, m.changeRole].flatMap((f) => f.mock.calls)).toEqual([]);
  });
  it('the last-administrator refusal is a 409 with its explanation', async () => {
    m.changeRole.mockRejectedValue(new ApiError(409, 'A company needs at least one administrator. Make someone else an administrator first.'));
    const res = await member.PATCH(post({ roleKey: 'mpw-finance' }), ctx({ customerId: 'c1' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('administrator');
  });
  it('the invitation response carries the one-time password and is not cacheable', async () => {
    m.inviteColleague.mockResolvedValue({ member: { customerId: 'n' }, temporaryPassword: 'abcde-fghjk-23456' });
    const res = await team.POST(post({ firstName: 'A', lastName: 'B', email: 'a@b.co', roleKey: 'mpw-finance' }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.json()).temporaryPassword).toBe('abcde-fghjk-23456');
  });
});
