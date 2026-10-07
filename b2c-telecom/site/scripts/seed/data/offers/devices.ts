import type { ProductDraft } from '../../types';
import { DEVICE_OUTRIGHT, financedPrices, oneTimePrices, TERM_KEY } from '../prices';
import { DEVICES, deviceSku, deviceVariants } from '../products/devices';
import { buildOffer } from './helpers';

/**
 * One offer per handset, one variant per color x memory (D-015). Every variant carries the outright price (one-time) and
 * the financed prices tied to the device recurrence policies; the acquisition mode is a line item field, not a variant.
 */
export const deviceOffers: ProductDraft[] = DEVICES.map((spec) => {
  const key = `malva-offer-${spec.key.replace(/^malva-/, '')}`;
  return buildOffer({
    key,
    variants: deviceVariants(spec).map(({ color, memory }) => {
      const outright = DEVICE_OUTRIGHT[key][memory];
      return {
        sku: deviceSku(spec, color, memory),
        values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'one-time', color, 'memory-gb': memory },
        prices: [...oneTimePrices(outright), ...financedPrices(outright)],
      };
    }),
  });
});
