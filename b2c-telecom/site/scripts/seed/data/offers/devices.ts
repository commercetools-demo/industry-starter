import type { ProductDraft } from '../../types';
import { devicePriceSpecs, TERM_KEY } from '../prices';
import { DEVICES, deviceSku, deviceVariants } from '../products/devices';
import { buildOffer } from './helpers';

/**
 * One offer per handset, one variant per color x memory (D-015). Every variant carries the outright price (one-time) and the
 * financed prices tied to the device recurrence policies (the table is in `prices.ts`: Nova 5G has no lease and one variant lacks its
 * 36-month price on purpose); the acquisition mode is a line item field, not a variant.
 */
export const deviceOffers: ProductDraft[] = DEVICES.map((spec) => {
  const key = `malva-offer-${spec.key.replace(/^malva-/, '')}`;
  return buildOffer({
    key,
    variants: deviceVariants(spec).map(({ color, memory }) => {
      const sku = deviceSku(spec, color, memory);
      return {
        sku,
        values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'one-time', color, 'memory-gb': memory },
        prices: devicePriceSpecs(key, memory, sku),
      };
    }),
  });
});
