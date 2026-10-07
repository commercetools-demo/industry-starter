import type { ProductTypeDraft } from '../../types';
import { own, shared } from '../shared/attributes';

const required = { isRequired: true };

export const phonePlanType: ProductTypeDraft = {
  key: 'malva-phone-plan',
  name: 'Malva phone plan',
  description: 'Descriptive facts of a phone plan, sold per line. Sold through offers (`malva-offer`).',
  attributes: [
    shared('contract-term', required),
    shared('charge-type', required),
    shared('network-generation', required),
    shared('typical-download-mbps', required),
    shared('typical-upload-mbps', required),
    shared('typical-latency-ms', required),
    shared('data-gb', required),
    own('lines-included', 'Lines included', 'Enthaltene Leitungen', { name: 'number' }, { isRequired: true }),
    own('hotspot-gb', 'Hotspot (GB, 0 = none, -1 = unlimited)', 'Hotspot (GB, 0 = keiner, -1 = unbegrenzt)', { name: 'number' }, { isRequired: true }),
    shared('price-lock-months', required),
    shared('activation-fee', required),
    shared('early-termination-fee', required),
    shared('badge'),
    shared('label-plan-id', required),
    shared('bundle-discount-text', required),
    shared('included-addons'),
    shared('conflicts-with'),
    shared('highlights'),
  ],
};
