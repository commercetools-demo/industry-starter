import type { AnyReconciler, Kind } from '../types';
import { cartDiscountReconciler } from './cartDiscount';
import { categoryReconciler } from './category';
import { customerGroupReconciler } from './customerGroup';
import { discountCodeReconciler } from './discountCode';
import { productTypeReconciler } from './productType';
import { recurrencePolicyReconciler } from './recurrencePolicy';
import { shippingMethodReconciler } from './shippingMethod';
import { taxCategoryReconciler } from './taxCategory';
import { typeReconciler } from './type';
import { zoneCoverageReconciler } from './zoneCoverage';

// One entry per kind. Workstream G appends customObject, demoCustomer, demoOrder here.
export const reconcilers: AnyReconciler[] = [
  typeReconciler,
  taxCategoryReconciler,
  zoneCoverageReconciler,
  customerGroupReconciler,
  recurrencePolicyReconciler,
  productTypeReconciler,
  categoryReconciler,
  shippingMethodReconciler,
  cartDiscountReconciler,
  discountCodeReconciler,
];

export function getReconciler(kind: Kind): AnyReconciler | undefined {
  return reconcilers.find((r) => r.kind === kind);
}
