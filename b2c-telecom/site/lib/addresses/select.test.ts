import { pickPreselected } from './select';
import type { SavedAddress } from '@/lib/types';

const address = (id: string, isDefaultService = false): SavedAddress => ({
  id,
  firstName: 'Ada',
  lastName: 'L',
  streetName: '1 Main St',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
  isService: true,
  isBilling: false,
  isDefaultService,
  isDefaultBilling: false,
});

describe('pickPreselected', () => {
  it('Default preselected for a new order: returns the default service address of three', () => {
    expect(pickPreselected([address('a'), address('b', true), address('c')])?.id).toBe('b');
  });
  it('Default address removed: no default means no preselection', () => {
    expect(pickPreselected([address('a'), address('b')])).toBeNull();
    expect(pickPreselected([address('only')])).toBeNull();
    expect(pickPreselected([])).toBeNull();
  });
});
