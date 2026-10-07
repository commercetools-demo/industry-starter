// @vitest-environment node
import { newCartDraft } from './cart-defaults';

const market = { currency: 'USD', country: 'US', locale: 'en-US' };

describe('newCartDraft', () => {
  it('New cart: inventory None and platform tax', () => {
    expect(newCartDraft(market)).toMatchObject({ currency: 'USD', country: 'US', locale: 'en-US', inventoryMode: 'None', taxMode: 'Platform' });
  });
  it('adds anonymousId only for anonymous sessions', () => {
    expect(newCartDraft({ ...market, anonymousId: 'a1' })).toMatchObject({ anonymousId: 'a1' });
    const signedIn = newCartDraft({ ...market, customerId: 'u1', anonymousId: 'a1' });
    expect(signedIn).toMatchObject({ customerId: 'u1' });
    expect(signedIn).not.toHaveProperty('anonymousId');
    expect(newCartDraft(market)).not.toHaveProperty('anonymousId');
  });
});
