import type { ProductDraft } from '../../types';
import { addonOffers } from './addons';
import { deviceOffers } from './devices';
import { equipmentOffers } from './equipment';
import { cableOffers } from './plans-cable';
import { phoneOffers, phoneOnlineOnlyOffer } from './plans-phone';
import { wirelessOffers } from './plans-wireless';

/** The 27 offers, in the order of the offer table. */
export const offers: ProductDraft[] = [
  ...cableOffers,
  ...wirelessOffers,
  ...phoneOffers,
  phoneOnlineOnlyOffer,
  ...addonOffers,
  ...equipmentOffers,
  ...deviceOffers,
];
