import type { TaxCategoryDraft } from '../types';

// One placeholder category with a rate per country (D-044). The sample category `standard-tax` is not touched.
export const taxCategories: TaxCategoryDraft[] = [
  {
    key: 'malva-telecom-services',
    name: 'Malva telecom services (PLACEHOLDER 0%)',
    description: 'Placeholder rates. Real telecom tax treatment is out of scope (D-044).',
    rates: [
      { key: 'malva-tax-us', name: 'US placeholder 0%', amount: 0, includedInPrice: false, country: 'US' },
      { key: 'malva-tax-de', name: 'DE placeholder 0%', amount: 0, includedInPrice: true, country: 'DE' },
    ],
  },
];
