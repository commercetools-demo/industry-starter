import { tableResolver } from './resolver';
import type { AddressInput } from '@/lib/types';

const base: AddressInput = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isService: true, isBilling: true };

describe('tableResolver', () => {
  it('resolves a matching city and state, ignoring case and spaces', async () => {
    expect((await tableResolver.resolve({ ...base, city: ' new york ' })).status).toBe('resolved');
  });
  it('uses only the first five digits of a ZIP+4', async () => {
    expect((await tableResolver.resolve({ ...base, postalCode: '10001-4444' })).status).toBe('resolved');
  });
  it('names the city and the nearest match when the city differs', async () => {
    const result = await tableResolver.resolve({ ...base, city: 'Brooklyn' });
    expect(result).toEqual({ status: 'unresolved', unresolvedFields: ['city'], nearestMatch: { city: 'New York', state: 'NY', postalCode: '10001', country: 'US' } });
  });
  it('names the state when only the state differs', async () => {
    expect((await tableResolver.resolve({ ...base, state: 'CA' })).unresolvedFields).toEqual(['state']);
  });
  it('resolves a postal code that is not in the table', async () => {
    expect(await tableResolver.resolve({ ...base, postalCode: '99999', city: 'Nowhere' })).toEqual({ status: 'resolved', unresolvedFields: [] });
  });
  it('compares German umlauts after NFC normalisation', async () => {
    const de: AddressInput = { firstName: 'A', lastName: 'B', streetName: 'Str. 1', city: 'München', postalCode: '80331', country: 'DE', isService: true, isBilling: false };
    expect((await tableResolver.resolve(de)).status).toBe('resolved');
    expect((await tableResolver.resolve({ ...de, city: 'Hamburg' })).nearestMatch).toEqual({ city: 'München', postalCode: '80331', country: 'DE' });
  });
});
