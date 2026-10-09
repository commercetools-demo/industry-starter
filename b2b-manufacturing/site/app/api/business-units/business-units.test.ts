// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated, mockSession, sessionMock } from '../../../test/api-helpers';

const save = vi.fn();
const list = vi.fn();
const select = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current, saveSession: save }));
vi.mock('@/lib/ct/business-units', () => ({ getBusinessUnitsForAssociate: list, selectBusinessUnit: select }));
const { GET } = await import('./route');
const { POST } = await import('./select/route');
const post = (body: unknown) => POST(new Request('http://x/api/business-units/select', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

describe('malva-business-unit-context › routes', () => {
  it('401 without a customer, no commercetools call', async () => {
    await expectUnauthenticated(GET as never, list);
    await expectUnauthenticated((() => post({ businessUnitKey: 'a' })) as never, select);
  });
  it('lists the units and the current one', async () => {
    mockSession({ customerId: 'c1', businessUnitKey: 'a' });
    list.mockResolvedValue([{ key: 'a' }]);
    expect(await (await GET()).json()).toEqual({ businessUnits: [{ key: 'a' }], current: 'a' });
  });
  it('400 for a missing or malformed body', async () => {
    mockSession({ customerId: 'c1' });
    expect((await post({})).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
    expect(select).not.toHaveBeenCalled();
  });
  it('403 for a unit that is not theirs; nothing saved', async () => {
    mockSession({ customerId: 'c1' }); select.mockResolvedValue(null);
    expect((await post({ businessUnitKey: 'z' })).status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });
  it('saves the new context on success', async () => {
    mockSession({ customerId: 'c1' }); select.mockResolvedValue({ businessUnitKey: 'b' });
    expect(await (await post({ businessUnitKey: 'b' })).json()).toEqual({ businessUnitKey: 'b' });
    expect(save).toHaveBeenCalledWith({ businessUnitKey: 'b' });
  });
});
