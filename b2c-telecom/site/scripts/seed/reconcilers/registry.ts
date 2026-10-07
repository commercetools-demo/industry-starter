import type { AnyReconciler, Kind } from '../types';
import { cartDiscountReconciler } from './cartDiscount';
import { categoryReconciler } from './category';
import { customerGroupReconciler } from './customerGroup';
import { customObjectReconciler } from './customObject';
import { demoCustomerReconciler } from './demoCustomer';
import { demoOrderReconciler } from './demoOrder';
import { discountCodeReconciler } from './discountCode';
import { inventoryReconciler } from './inventory';
import { productReconciler } from './product';
import { productTypeReconciler } from './productType';
import { recurrencePolicyReconciler } from './recurrencePolicy';
import { shippingMethodReconciler } from './shippingMethod';
import { taxCategoryReconciler } from './taxCategory';
import { typeReconciler } from './type';
import { zoneCoverageReconciler } from './zoneCoverage';

// One entry per kind. Workstream G appended customObject, demoCustomer, demoOrder.
export const reconcilers: AnyReconciler[] = [
  typeReconciler,
  taxCategoryReconciler,
  zoneCoverageReconciler,
  customerGroupReconciler,
  customObjectReconciler,
  recurrencePolicyReconciler,
  productTypeReconciler,
  categoryReconciler,
  shippingMethodReconciler,
  cartDiscountReconciler,
  discountCodeReconciler,
  productReconciler,
  inventoryReconciler,
  demoCustomerReconciler,
  demoOrderReconciler,
];

export function getReconciler(kind: Kind): AnyReconciler | undefined {
  return reconcilers.find((r) => r.kind === kind);
}
