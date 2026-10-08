// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ct/client', async () => ({ apiRoot: (await import('@/lib/ct/account-fixtures')).fakeListsRoot }));

import { resetAccountFixtures } from '@/lib/ct/account-fixtures';
import { addLines, createList, deleteList, getOrCreateDefaultList, getOwnList, ListLimitError, listLists, removeLine, renameList } from '@/lib/ct/shopping-lists';
import { listLineFieldsOf } from '@/lib/mappers/shopping-list';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const line = (sku: string, rx = 'RX-77102', ref = 'a') => ({ sku, rxNumber: rx, rxLineRef: ref, price: usd(1875) });

beforeEach(() => resetAccountFixtures());

describe('saved-lists: shopping list module', () => {
  it('creates a customer list with key mlv-list-<id>, a 360 day expiry and the line reference', async () => {
    const list = await createList('c1', '  Monthly   meds ', 'en-US', { id: 'abc', lines: [line('MED-a')] });
    expect(list).toMatchObject({ key: 'mlv-list-abc', customer: { id: 'c1' }, deleteDaysAfterLastModification: 360, name: { 'en-US': 'Monthly meds' } });
    expect(list.lineItems).toHaveLength(1);
    const f = listLineFieldsOf(list.lineItems[0]!);
    expect(f).toMatchObject({ rxNumber: 'RX-77102', rxLineRef: 'a', savedPrice: { centAmount: 1875 } });
  });

  it('stores no signature: the saved line carries only the reference and the price', async () => {
    const list = await createList('c1', 'x', 'en-US', { lines: [line('MED-a')] });
    expect(Object.keys((list.lineItems[0]!.custom as { fields: object }).fields).sort()).toEqual(['rxLineRef', 'rxNumber', 'savedUnitPrice']);
  });

  it('lists only the own lists', async () => {
    await createList('c1', 'Mine', 'en-US');
    await createList('c2', 'Theirs', 'en-US');
    const lists = await listLists('c1', 'en-US');
    expect(lists.map((l) => l.name)).toEqual(['Mine']);
    expect(lists[0]).toMatchObject({ lineCount: 0 });
  });

  it('a foreign list is the same null as an unknown one, for read, rename, add, remove and delete', async () => {
    const theirs = await createList('c2', 'Theirs', 'en-US', { lines: [line('MED-a')] });
    expect(await getOwnList(theirs.id, 'c1')).toBeNull();
    expect(await getOwnList('nope', 'c1')).toBeNull();
    expect(await getOwnList('../x', 'c1')).toBeNull();
    expect(await renameList(theirs.id, 'c1', 'Mine now', 'en-US')).toBeNull();
    expect(await addLines(theirs.id, 'c1', [line('MED-b', 'RX-1', 'z')])).toBeNull();
    expect(await removeLine(theirs.id, 'c1', theirs.lineItems[0]!.id)).toBeNull();
    expect(await deleteList(theirs.id, 'c1')).toBe(false);
    expect((await getOwnList(theirs.id, 'c2'))?.lineItems).toHaveLength(1);
  });

  it('renames, adds without duplicating the same prescription line, removes and deletes', async () => {
    const list = await createList('c1', 'Meds', 'en-US');
    expect((await renameList(list.id, 'c1', 'Renamed', 'en-US'))?.name['en-US']).toBe('Renamed');
    const first = await addLines(list.id, 'c1', [line('MED-a'), line('MED-a'), line('MED-b', 'RX-77102', 'b')]);
    expect(first?.added).toBe(2);
    const again = await addLines(list.id, 'c1', [line('MED-a')]);
    expect(again?.added).toBe(0);
    expect(again?.list.lineItems).toHaveLength(2);
    const removed = await removeLine(list.id, 'c1', again!.list.lineItems[0]!.id);
    expect(removed?.lineItems).toHaveLength(1);
    expect(await deleteList(list.id, 'c1')).toBe(true);
    expect(await getOwnList(list.id, 'c1')).toBeNull();
  });

  it('refuses an empty name and a list over 250 lines', async () => {
    await expect(createList('c1', '   ', 'en-US')).rejects.toBeInstanceOf(ListLimitError);
    const list = await createList('c1', 'Big', 'en-US');
    const many = Array.from({ length: 251 }, (_, i) => line(`MED-${i}`, 'RX-1', `r${i}`));
    await expect(addLines(list.id, 'c1', many)).rejects.toBeInstanceOf(ListLimitError);
  });

  it('the default list "My medicines" is created once per customer', async () => {
    const a = await getOrCreateDefaultList('c1', 'en-US', 'My medicines');
    const b = await getOrCreateDefaultList('c1', 'en-US', 'My medicines');
    expect(b.id).toBe(a.id);
    expect(a.key).toContain('mlv-list-my-medicines');
    expect((await getOrCreateDefaultList('c2', 'en-US', 'My medicines')).id).not.toBe(a.id);
  });
});
