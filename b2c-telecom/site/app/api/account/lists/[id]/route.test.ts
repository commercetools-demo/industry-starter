// @vitest-environment node
import { ApiError } from '@/lib/api-error';

const state = vi.hoisted(() => ({ requireCustomer: vi.fn(), getList: vi.fn(), getLists: vi.fn(), renameList: vi.fn(), deleteList: vi.fn(), addOffer: vi.fn(), removeLine: vi.fn(), toDetail: vi.fn() }));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/lists', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ct/lists')>()),
  getList: state.getList,
  getLists: state.getLists,
  renameList: state.renameList,
  deleteList: state.deleteList,
  addOffer: state.addOffer,
  removeLine: state.removeLine,
  toDetail: state.toDetail,
}));

import { ListFullError, ListNotFoundError } from '@/lib/ct/lists';
import { POST as addLine } from './lines/route';
import { DELETE as removeLine } from './lines/[lineId]/route';
import { DELETE, GET, PATCH } from './route';

const headers = { 'content-type': 'application/json', origin: 'http://localhost' };
const req = (method: string, body?: unknown) => new Request('http://localhost/api/account/lists/l1', { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = (id = 'l1') => ({ params: Promise.resolve({ id }) });
const lineParams = (id = 'l1', lineId = 'line-1') => ({ params: Promise.resolve({ id, lineId }) });
const detail = { id: 'l1', name: 'Home', lines: [] };

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-1' } });
  state.getList.mockResolvedValue(detail);
  state.getLists.mockResolvedValue([]);
  state.renameList.mockResolvedValue({});
  state.deleteList.mockResolvedValue(undefined);
  state.addOffer.mockResolvedValue({});
  state.removeLine.mockResolvedValue({});
  state.toDetail.mockResolvedValue(detail);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('/api/account/lists/[id]', () => {
  it('401 for an anonymous visitor on every route', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    const results = [await GET(req('GET'), params()), await PATCH(req('PATCH', { name: 'x' }), params()), await DELETE(req('DELETE'), params()), await addLine(req('POST', { offerKey: 'a' }), params()), await removeLine(req('DELETE'), lineParams())];
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });
  it('404 LIST_NOT_FOUND for a foreign list on every route', async () => {
    for (const fn of [state.getList, state.renameList, state.deleteList, state.addOffer, state.removeLine]) fn.mockRejectedValue(new ListNotFoundError());
    const results = [await GET(req('GET'), params('x')), await PATCH(req('PATCH', { name: 'x' }), params('x')), await DELETE(req('DELETE'), params('x')), await addLine(req('POST', { offerKey: 'a' }), params('x')), await removeLine(req('DELETE'), lineParams('x'))];
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
    expect(((await results[0]?.json()) as { error: { code: string } }).error.code).toBe('LIST_NOT_FOUND');
  });
  it('reads, renames and deletes with the session customer id', async () => {
    expect(await (await GET(req('GET'), params())).json()).toEqual({ list: detail });
    await PATCH(req('PATCH', { name: 'Office' }), params());
    expect(state.renameList).toHaveBeenCalledWith('cust-1', 'l1', 'Office');
    expect(await (await DELETE(req('DELETE'), params())).json()).toEqual({ lists: [] });
    expect(state.deleteList).toHaveBeenCalledWith('cust-1', 'l1');
  });
  it('adds an offer with defaults and answers the list', async () => {
    const response = await addLine(req('POST', { offerKey: 'malva-offer-spotify' }), params());
    expect(response.status).toBe(200);
    expect(state.addOffer).toHaveBeenCalledWith('cust-1', 'l1', { offerKey: 'malva-offer-spotify', variantId: undefined, quantity: undefined }, expect.objectContaining({ country: 'US' }));
  });
  it('400 for a bad offer key, variant or quantity and 422 LIST_FULL', async () => {
    expect((await addLine(req('POST', {}), params())).status).toBe(400);
    expect((await addLine(req('POST', { offerKey: 'a', quantity: 6 }), params())).status).toBe(400);
    expect((await addLine(req('POST', { offerKey: 'a', variantId: 0 }), params())).status).toBe(400);
    state.addOffer.mockRejectedValue(new ListFullError());
    const full = await addLine(req('POST', { offerKey: 'a' }), params());
    expect(full.status).toBe(422);
    expect(((await full.json()) as { error: { code: string } }).error.code).toBe('LIST_FULL');
  });
  it('removes a line', async () => {
    expect((await removeLine(req('DELETE'), lineParams())).status).toBe(200);
    expect(state.removeLine).toHaveBeenCalledWith('cust-1', 'l1', 'line-1');
  });
});
