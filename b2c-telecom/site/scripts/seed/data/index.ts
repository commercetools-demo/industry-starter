// The Malva seed manifest: F's data (market, tax, groups, recurrence, shipping) plus G's catalog.
import type { DemoCustomerDraft, DemoOrderDraft, SeedManifest } from '../types';
import { cartDiscounts } from './cart-discounts';
import { categories } from './categories';
import { customTypes } from './custom-types';
import { customerGroups } from './customer-groups';
import { demoCustomers } from './demo/customers';
import { demoOrders } from './demo/orders';
import { discountCodes } from './discount-codes';
import { inventory } from './inventory';
import { offers } from './offers';
import { productTypes } from './product-types';
import { descriptiveProducts } from './products';
import { deviceRecurrencePolicies } from './recurrence-devices';
import { recurrencePolicies } from './recurrence';
import { serviceability } from './serviceability';
import { shippingMethods } from './shipping';
import { taxCategories } from './tax';
import { zoneCoverage } from './zones';

/** Workstream F's part: market-level resources only (no catalog). */
export const PLATFORM_MANIFEST: SeedManifest = {
  taxCategory: taxCategories,
  zoneCoverage,
  customerGroup: customerGroups,
  recurrencePolicy: recurrencePolicies,
  shippingMethod: shippingMethods,
};

export const MANIFEST: SeedManifest = {
  ...PLATFORM_MANIFEST,
  recurrencePolicy: [...recurrencePolicies, ...deviceRecurrencePolicies],
  type: customTypes,
  productType: productTypes,
  category: categories,
  cartDiscount: cartDiscounts,
  discountCode: discountCodes,
  product: [...descriptiveProducts, ...offers],
  inventory,
  customObject: serviceability,
};

export const DEMO: { demoCustomer: DemoCustomerDraft[]; demoOrder: DemoOrderDraft[] } = { demoCustomer: demoCustomers, demoOrder: demoOrders };
