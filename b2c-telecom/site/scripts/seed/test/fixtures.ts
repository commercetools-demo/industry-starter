import type { ProductTypeDraft } from '../types';

/** A product type that defines `offer-kind` as a line item attribute (what the Malva shipping predicates need). */
export const offerType: ProductTypeDraft = {
  key: 'malva-offer',
  name: 'Offer',
  description: 'Test offer type',
  attributes: [
    {
      name: 'offer-kind',
      label: { 'en-US': 'Kind', 'de-DE': 'Art' },
      isRequired: true,
      savedToLineItem: true,
      type: {
        name: 'enum',
        values: [
          { key: 'base-package', label: 'Base package' },
          { key: 'equipment', label: 'Equipment' },
          { key: 'device', label: 'Device' },
          { key: 'bundle', label: 'Bundle' },
          { key: 'addon', label: 'Add-on' },
        ],
      },
    },
  ],
};
