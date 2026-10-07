import type { ProductTypeDraft } from '../../types';
import { EQUIPMENT_KIND, REQUIRED_ADDON_KINDS } from '../shared/enums';
import { own, shared } from '../shared/attributes';

const required = { isRequired: true };

export const internetPlanType: ProductTypeDraft = {
  key: 'malva-internet-plan',
  name: 'Malva internet plan',
  description: 'Descriptive facts of a home internet plan. Sold through offers (`malva-offer`).',
  attributes: [
    shared('technology', required),
    shared('downstream-mbps', required),
    shared('upstream-mbps', required),
    shared('contract-term', required),
    shared('charge-type', required),
    shared('network-generation'),
    shared('typical-download-mbps', required),
    shared('typical-upload-mbps', required),
    shared('typical-latency-ms', required),
    shared('data-gb', required),
    shared('price-lock-months', required),
    shared('activation-fee', required),
    shared('early-termination-fee', required),
    shared('badge'),
    shared('label-plan-id', required),
    shared('bundle-discount-text', required),
    shared('included-addons'),
    shared('conflicts-with'),
    own('required-equipment-kinds', 'Required equipment kinds', 'Erforderliche Gerätearten', { name: 'set', elementType: { name: 'enum', values: EQUIPMENT_KIND } }),
    own('required-addon-kinds', 'Required add-on kinds', 'Erforderliche Zusatzarten', { name: 'set', elementType: { name: 'enum', values: REQUIRED_ADDON_KINDS } }),
    shared('highlights'),
  ],
};
