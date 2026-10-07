// Assembles the seed manifest from the typed data modules. Workstream G appends its kinds (product types,
// categories, products, inventory, discounts, custom objects) here.
import { customerGroups } from './data/customer-groups';
import { recurrencePolicies } from './data/recurrence';
import { shippingMethods } from './data/shipping';
import { taxCategories } from './data/tax';
import { zoneCoverage } from './data/zones';
import type { SeedManifest } from './types';

export function buildManifest(_opts: { withDemo: boolean } = { withDemo: false }): SeedManifest {
  return {
    taxCategory: taxCategories,
    zoneCoverage,
    customerGroup: customerGroups,
    recurrencePolicy: recurrencePolicies,
    shippingMethod: shippingMethods,
  };
}
