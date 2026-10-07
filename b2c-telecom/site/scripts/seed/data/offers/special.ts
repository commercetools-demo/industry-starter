// The two special offers are built next to their families (they need the same price rows):
//  - `malva-offer-cable-existing-customer` (existing customers only) in plans-cable.ts
//  - `malva-offer-phone-online-only` (channel offer) in plans-phone.ts
// This module names them so the "Offers wrap what is sold" checks and X find them in one place.
import type { ProductDraft } from '../../types';
import { cableOffers } from './plans-cable';
import { phoneOnlineOnlyOffer } from './plans-phone';

export const EXISTING_CUSTOMER_OFFER_KEY = 'malva-offer-cable-existing-customer';
export const ONLINE_ONLY_OFFER_KEY = 'malva-offer-phone-online-only';

export const existingCustomerOffer: ProductDraft = cableOffers.find((o) => o.key === EXISTING_CUSTOMER_OFFER_KEY) as ProductDraft;
export const onlineOnlyOffer: ProductDraft = phoneOnlineOnlyOffer;
