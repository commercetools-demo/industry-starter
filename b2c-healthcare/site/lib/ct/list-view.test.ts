import { beforeEach, describe, expect, it, vi } from 'vitest';

const catalog = vi.fn();
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: (...a: unknown[]) => catalog(...a) }));
const findOwn = vi.fn();
vi.mock('@/lib/ct/prescriptions', () => ({ findOwnPrescription: (...a: unknown[]) => findOwn(...a) }));
const lists = vi.hoisted(() => ({ addLines: vi.fn(), getOrCreateDefaultList: vi.fn(), getOwnList: vi.fn() }));
vi.mock('@/lib/ct/shopping-lists', () => lists);

import { getListView, saveRxLines } from './list-view';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const item = (id: string, sku: string, saved?: number) => ({
  id,
  name: { 'en-US': `name-${sku}` },
  variant: { sku },
  custom: { fields: { rxNumber: 'RX-1', rxLineRef: id, ...(saved ? { savedUnitPrice: { centAmount: saved, currencyCode: 'USD', fractionDigits: 2 } } : {}) } },
});
const med = (name: string, price: ReturnType<typeof usd> | null, sellable?: boolean) => ({ medication: { name, price, ...(sellable === undefined ? {} : { sellableInRegion: sellable }) }, shortDatedPrice: null });

beforeEach(() => {
  catalog.mockReset();
  findOwn.mockReset();
  for (const fn of Object.values(lists)) fn.mockReset();
});

describe('saved-lists: list detail prices', () => {
  it('reads every price in ONE catalog call (no cart) and shows the delta when the price moved since saving', async () => {
    catalog.mockResolvedValue(new Map([['A', med('Atorvastatin', usd(2000))], ['B', med('Lisinopril', usd(1140))]]));
    const list = { id: 'l1', name: { 'en-US': 'Meds' }, lastModifiedAt: 't', lineItems: [item('1', 'A', 1875), item('2', 'B', 1140), item('3', 'A')] };
    const v = await getListView(list as never, ctx);
    expect(catalog).toHaveBeenCalledTimes(1);
    expect(v.lines.map((l) => [l.price?.centAmount, l.priceDeltaCents, l.unavailable])).toEqual([
      [2000, 125, false],
      [1140, null, false],
      [2000, null, false],
    ]);
    expect(v).toMatchObject({ id: 'l1', name: 'Meds', lineCount: 3 });
  });

  it('a product that left the catalog or has no price in the region is flagged unavailable, never a broken price', async () => {
    catalog.mockResolvedValue(new Map([['B', med('Lisinopril', null)], ['C', med('Metformin', usd(900), false)]]));
    const v = await getListView({ id: 'l', name: {}, lastModifiedAt: 't', lineItems: [item('1', 'A'), item('2', 'B'), item('3', 'C')] } as never, ctx);
    expect(v.lines.map((l) => [l.price, l.unavailable])).toEqual([[null, true], [null, true], [null, true]]);
    expect(v.lines[0]?.name).toBe('name-A');
  });
});

describe('saved-lists: Save to My medicines', () => {
  const rx = { number: 'RX-77102', patientRef: 'pt', lines: [{ lineRef: 'a', sku: 'A', qty: 30, sig: 'secret sig' }, { lineRef: 'b', sku: 'B', qty: 30, sig: 'x' }] };

  it('saves the chosen lines of the own prescription to the default list with the catalog price and no sig', async () => {
    findOwn.mockResolvedValue(rx);
    lists.getOrCreateDefaultList.mockResolvedValue({ id: 'def' });
    catalog.mockResolvedValue(new Map([['A', med('A', usd(1875))]]));
    lists.addLines.mockResolvedValue({ list: {}, added: 1 });
    const r = await saveRxLines('c1', { patientRef: 'pt', name: 'Sam' }, 'RX-77102', ['a'], { defaultName: 'My medicines', ctx });
    expect(r).toEqual({ listId: 'def', saved: 1, alreadySaved: 0 });
    expect(lists.addLines).toHaveBeenCalledWith('def', 'c1', [{ sku: 'A', rxNumber: 'RX-77102', rxLineRef: 'a', price: usd(1875) }]);
    expect(JSON.stringify(lists.addLines.mock.calls)).not.toContain('secret sig');
  });

  it('a second save of the same line reports it as already saved', async () => {
    findOwn.mockResolvedValue(rx);
    lists.getOrCreateDefaultList.mockResolvedValue({ id: 'def' });
    catalog.mockResolvedValue(new Map());
    lists.addLines.mockResolvedValue({ list: {}, added: 0 });
    expect(await saveRxLines('c1', { patientRef: 'pt', name: 'Sam' }, 'RX-77102', ['a', 'b'], { defaultName: 'My medicines', ctx })).toEqual({ listId: 'def', saved: 0, alreadySaved: 2 });
  });

  it('a prescription that is not the patient\'s, no matching line, or a foreign target list: null', async () => {
    findOwn.mockResolvedValue(null);
    expect(await saveRxLines('c1', { patientRef: 'pt', name: 'Sam' }, 'RX-9', ['a'], { defaultName: 'x', ctx })).toBeNull();
    findOwn.mockResolvedValue(rx);
    expect(await saveRxLines('c1', { patientRef: 'pt', name: 'Sam' }, 'RX-77102', ['zzz'], { defaultName: 'x', ctx })).toBeNull();
    lists.getOwnList.mockResolvedValue(null);
    expect(await saveRxLines('c1', { patientRef: 'pt', name: 'Sam' }, 'RX-77102', ['a'], { listId: 'theirs', defaultName: 'x', ctx })).toBeNull();
    expect(lists.addLines).not.toHaveBeenCalled();
  });
});
