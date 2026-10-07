// Cart discounts (D-014, D-027). Predicates use backtick-escaped attribute names (hyphens); proven live in G-18.
// Docs: https://docs.commercetools.com/api/projects/cartDiscounts , https://docs.commercetools.com/api/projects/predicates
import type { CartDiscountDraft } from '../types';
import { ls } from './catalog-types';

const money = (cents: number): { currencyCode: string; centAmount: number }[] => [
  { currencyCode: 'USD', centAmount: cents },
  { currencyCode: 'EUR', centAmount: cents },
];

const PHONE_UNIT = 'attributes.`offer-family` = "phone"';
const HOME_INTERNET = 'attributes.`offer-family` in ("cable","fixed-wireless")';

/** Introductory and tiered examples are data for L: the platform cannot end a discount after N periods. */
export const SKU_YEAR1_GIG = 'MLV-CBL-GIG-24M';
export const SKU_YEAR1_MAX = 'MLV-PHN-UNLMAX-24M';

export const cartDiscounts: CartDiscountDraft[] = [
  {
    key: 'malva-cd-second-line-10',
    name: ls('Second line $10 off', 'Zweite Leitung 10 € weniger'),
    description: ls('The first phone line pays full price; lines 2 to 5 get $10 off each.', 'Die erste Leitung kostet den vollen Preis; die Leitungen 2 bis 5 kosten je 10 € weniger.'),
    value: { type: 'absolute', money: money(1000), applicationMode: 'IndividualApplication' },
    cartPredicate: 'true',
    target: {
      type: 'pattern',
      triggerPattern: [{ type: 'CountOnLineItemUnits', predicate: PHONE_UNIT, minCount: 1, maxCount: 1 }],
      targetPattern: [{ type: 'CountOnLineItemUnits', predicate: PHONE_UNIT, minCount: 1, maxCount: 4 }],
      maxOccurrence: 1,
      selectionMode: 'Cheapest',
    },
    sortOrder: '0.1',
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: false,
    recurringOrderScope: { type: 'AnyOrder' },
  },
  {
    key: 'malva-cd-bundle-5',
    name: ls('Bundle with a phone plan: $5 off', 'Mit Handytarif kombinieren: 5 € weniger'),
    description: ls('A phone plan together with cable or wireless internet saves $5 a month.', 'Ein Handytarif zusammen mit Kabel- oder Funk-Internet spart 5 € im Monat.'),
    value: { type: 'absolute', money: money(500) },
    cartPredicate: `lineItemExists(${PHONE_UNIT}) = true and lineItemExists(${HOME_INTERNET}) = true`,
    target: { type: 'lineItems', predicate: HOME_INTERNET },
    sortOrder: '0.2',
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: false,
    recurringOrderScope: { type: 'AnyOrder' },
  },
  {
    key: 'malva-cd-intro-free-month',
    name: ls('First month free', 'Erster Monat gratis'),
    description: ls('Plans with an introductory period are free for the first order.', 'Tarife mit Einführungsphase sind in der ersten Bestellung gratis.'),
    value: { type: 'relative', permyriad: 10000 },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: 'attributes.`intro-free-months` > 0' },
    sortOrder: '0.3',
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: false,
    recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
  },
  {
    key: 'malva-cd-tier-year1-20',
    name: ls('Cable Gig: 20% off in year 1', 'Cable Gig: 20 % Rabatt im ersten Jahr'),
    description: ls('First-year price step of Cable Gig (the later steps are on the order schedule).', 'Preisstufe im ersten Jahr für Cable Gig (die späteren Stufen stehen im Preisplan der Bestellung).'),
    value: { type: 'relative', permyriad: 2000 },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: `sku = "${SKU_YEAR1_GIG}"` },
    sortOrder: '0.4',
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: false,
    recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
  },
  {
    key: 'malva-cd-tier-year1-15',
    name: ls('Unlimited Max: 15% off in year 1', 'Unlimited Max: 15 % Rabatt im ersten Jahr'),
    description: ls('First-year price step of Unlimited Max (the later steps are on the order schedule).', 'Preisstufe im ersten Jahr für Unlimited Max (die späteren Stufen stehen im Preisplan der Bestellung).'),
    value: { type: 'relative', permyriad: 1500 },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: `sku = "${SKU_YEAR1_MAX}"` },
    sortOrder: '0.5',
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: false,
    recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
  },
  {
    key: 'malva-cd-welcome-10',
    name: ls('Welcome offer: $10 off', 'Willkommensangebot: 10 € weniger'),
    description: ls('$10 off the first order with the code WELCOME10.', '10 € Rabatt auf die erste Bestellung mit dem Code WELCOME10.'),
    value: { type: 'absolute', money: money(1000) },
    cartPredicate: 'true',
    target: { type: 'totalPrice' },
    sortOrder: '0.6',
    stackingMode: 'Stacking',
    isActive: true,
    requiresDiscountCode: true,
    recurringOrderScope: { type: 'NonRecurringOrdersOnly' },
  },
];
