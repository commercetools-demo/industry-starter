// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const withContainer = vi.fn(() => ({ get: (args: unknown) => ({ execute: () => get(args) }) }));
const buGet = vi.fn();
vi.mock('./client', () => ({ apiRoot: { customObjects: () => ({ withContainer }), businessUnits: () => ({ withKey: () => ({ get: () => ({ execute: buGet }) }) }) } }));
const { fetchRecords, fetchSiteNames, CONTAINERS } = await import('./portal-data');
beforeEach(() => { get.mockReset(); withContainer.mockClear(); buGet.mockReset(); });

describe('malva-client-portal › Custom Object data (workstream T)', () => {
  it('queries by the key range of the session Business Unit and returns the values', async () => {
    get.mockResolvedValue({ body: { results: [{ value: { id: 'v1' } }, { value: { id: 'v2' } }] } });
    expect(await fetchRecords(CONTAINERS.visits, 'mpw-demo-co')).toEqual([{ id: 'v1' }, { id: 'v2' }]);
    expect(withContainer).toHaveBeenCalledWith({ container: 'mpw-visits' });
    expect(get.mock.calls[0]![0].queryArgs.where).toBe('key >= "mpw-demo-co." and key < "mpw-demo-co/"');
  });
  it('pages through more than one page of results', async () => {
    get.mockResolvedValueOnce({ body: { results: Array.from({ length: 100 }, (_, i) => ({ value: { id: `a${i}` } })) } }).mockResolvedValueOnce({ body: { results: [{ value: { id: 'z' } }] } });
    expect(await fetchRecords(CONTAINERS.invoices, 'bu')).toHaveLength(101);
    expect(get.mock.calls[1]![0].queryArgs.offset).toBe(100);
  });
  it('never queries with a unit key that could alter the predicate', async () => {
    for (const bad of ['a" or key > "', '', 'a b', 'a.b']) expect(await fetchRecords(CONTAINERS.visits, bad)).toEqual([]);
    expect(get).not.toHaveBeenCalled();
    expect(await fetchSiteNames('x" y')).toEqual({});
  });
  it('reads site names from the company addresses', async () => {
    buGet.mockResolvedValue({ body: { addresses: [{ key: 's1', company: 'Main plant' }, { key: 's2', streetName: '1 Road', city: 'Leeds' }, { streetName: 'no key' }] } });
    expect(await fetchSiteNames('bu')).toEqual({ s1: 'Main plant', s2: '1 Road, Leeds' });
  });
});
