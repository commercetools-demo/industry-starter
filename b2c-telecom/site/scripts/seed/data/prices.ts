// The single price table and the price builders (D-011, D-012). USD cents are the source; EUR = USD rounded to whole euros
// (table rule, no FX conversion): half rounds up.
import { COUNTRY_OF, POLICY_MONTHLY, type Currency, type PriceSpec } from './catalog-types';

export const CURRENCIES: Currency[] = ['USD', 'EUR'];

export function eurFromUsd(usdCents: number): number {
  return Math.round(usdCents / 100) * 100;
}

export function amountIn(currency: Currency, usdCents: number): number {
  return currency === 'USD' ? usdCents : eurFromUsd(usdCents);
}

/** Monthly (recurring) prices tied to a recurrence policy, USD/US and EUR/DE. */
export function monthlyPrices(usdCents: number, policy: string = POLICY_MONTHLY): PriceSpec[] {
  return CURRENCIES.map((currency) => ({ currency, centAmount: amountIn(currency, usdCents), country: COUNTRY_OF[currency], recurrencePolicy: policy }));
}

/** One-time prices (no recurrence policy), USD/US and EUR/DE. */
export function oneTimePrices(usdCents: number): PriceSpec[] {
  return CURRENCIES.map((currency) => ({ currency, centAmount: amountIn(currency, usdCents), country: COUNTRY_OF[currency] }));
}

// ---------------------------------------------------------------------------------------------------------------
// Terms

export type TermToken = 'M2M' | '12M' | '24M';
export const TERM_KEY: Record<TermToken, string> = { M2M: 'month-to-month', '12M': '12-months', '24M': '24-months' };
export const TERM_MONTHS: Record<TermToken, number> = { M2M: 0, '12M': 12, '24M': 24 };

export interface TermVariant {
  sku: string;
  term: TermToken;
  usd: number;
}

/** Plan offers: variants in manifest order (master first, then M2M, 12M, 24M). */
export const PLAN_PRICES: Record<string, TermVariant[]> = {
  'malva-offer-cable-100': [
    { sku: 'MLV-CBL-100-24M', term: '24M', usd: 3999 },
    { sku: 'MLV-CBL-100-M2M', term: 'M2M', usd: 4999 },
    { sku: 'MLV-CBL-100-12M', term: '12M', usd: 4499 },
  ],
  'malva-offer-cable-500': [
    { sku: 'MLV-CBL-500-24M', term: '24M', usd: 5999 },
    { sku: 'MLV-CBL-500-M2M', term: 'M2M', usd: 6999 },
    { sku: 'MLV-CBL-500-12M', term: '12M', usd: 6499 },
  ],
  'malva-offer-cable-gig': [
    { sku: 'MLV-CBL-GIG-24M', term: '24M', usd: 7999 },
    { sku: 'MLV-CBL-GIG-M2M', term: 'M2M', usd: 8999 },
    { sku: 'MLV-CBL-GIG-12M', term: '12M', usd: 8499 },
  ],
  'malva-offer-cable-existing-customer': [{ sku: 'MLV-CBL-500-EXIST-24M', term: '24M', usd: 4999 }],
  'malva-offer-wireless-lite': [
    { sku: 'MLV-AIR-LITE-12M', term: '12M', usd: 4500 },
    { sku: 'MLV-AIR-LITE-M2M', term: 'M2M', usd: 5000 },
  ],
  'malva-offer-wireless-5g': [
    { sku: 'MLV-AIR-5G-12M', term: '12M', usd: 5500 },
    { sku: 'MLV-AIR-5G-M2M', term: 'M2M', usd: 6000 },
  ],
  'malva-offer-wireless-5g-plus': [
    { sku: 'MLV-AIR-5GPLUS-12M', term: '12M', usd: 7500 },
    { sku: 'MLV-AIR-5GPLUS-M2M', term: 'M2M', usd: 8000 },
  ],
  'malva-offer-phone-essential': [
    { sku: 'MLV-PHN-ESS-M2M', term: 'M2M', usd: 2500 },
    { sku: 'MLV-PHN-ESS-12M', term: '12M', usd: 2300 },
  ],
  'malva-offer-phone-plus': [
    { sku: 'MLV-PHN-PLUS-M2M', term: 'M2M', usd: 3500 },
    { sku: 'MLV-PHN-PLUS-12M', term: '12M', usd: 3300 },
    { sku: 'MLV-PHN-PLUS-24M', term: '24M', usd: 3100 },
  ],
  'malva-offer-phone-unlimited': [
    { sku: 'MLV-PHN-UNL-M2M', term: 'M2M', usd: 5000 },
    { sku: 'MLV-PHN-UNL-12M', term: '12M', usd: 4800 },
    { sku: 'MLV-PHN-UNL-24M', term: '24M', usd: 4600 },
  ],
  'malva-offer-phone-unlimited-max': [
    { sku: 'MLV-PHN-UNLMAX-M2M', term: 'M2M', usd: 6500 },
    { sku: 'MLV-PHN-UNLMAX-12M', term: '12M', usd: 6300 },
    { sku: 'MLV-PHN-UNLMAX-24M', term: '24M', usd: 6100 },
  ],
  'malva-offer-phone-online-only': [{ sku: 'MLV-PHN-UNL-ONLINE-M2M', term: 'M2M', usd: 4500 }],
};

/** One-time activation fee on every cable offer variant (USD cents; EUR follows the rule: 25 EUR). */
export const CABLE_ACTIVATION_FEE_CENTS = 2500;

/** Add-ons: one variant each, month-to-month, monthly. */
export const ADDON_PRICES: Record<string, { sku: string; usd: number }> = {
  'malva-offer-spotify': { sku: 'MLV-ADD-SPOTIFY-MTH', usd: 1000 },
  'malva-offer-appletv': { sku: 'MLV-ADD-APPLETV-MTH', usd: 1000 },
  'malva-offer-applemusic': { sku: 'MLV-ADD-APPLEMUSIC-MTH', usd: 1100 },
  'malva-offer-netflix': { sku: 'MLV-ADD-NETFLIX-MTH', usd: 800 },
  'malva-offer-disneyplus': { sku: 'MLV-ADD-DISNEY-MTH', usd: 800 },
  'malva-offer-cloud-200': { sku: 'MLV-ADD-CLOUD200-MTH', usd: 300 },
  'malva-offer-device-protect': { sku: 'MLV-ADD-DEVCARE-MTH', usd: 1200 },
  'malva-offer-secure': { sku: 'MLV-ADD-SECURE-MTH', usd: 500 },
};

/** Equipment: rental (monthly) and purchase (one-time) variants; the 5G gateway is rental only. */
export const EQUIPMENT_PRICES: Record<string, { rent: { sku: string; usd: number }; buy?: { sku: string; usd: number } }> = {
  'malva-offer-router-ac1200': { rent: { sku: 'MLV-EQP-AC1200-RENT', usd: 500 }, buy: { sku: 'MLV-EQP-AC1200-BUY', usd: 7999 } },
  'malva-offer-router-ax3000': { rent: { sku: 'MLV-EQP-AX3000-RENT', usd: 800 }, buy: { sku: 'MLV-EQP-AX3000-BUY', usd: 12999 } },
  'malva-offer-mesh-be9300': { rent: { sku: 'MLV-EQP-BE9300-RENT', usd: 1200 }, buy: { sku: 'MLV-EQP-BE9300-BUY', usd: 24999 } },
  'malva-offer-modem-docsis31': { rent: { sku: 'MLV-EQP-DOCSIS31-RENT', usd: 600 }, buy: { sku: 'MLV-EQP-DOCSIS31-BUY', usd: 9999 } },
  'malva-offer-5g-gateway': { rent: { sku: 'MLV-EQP-5GGW-RENT', usd: 1000 } },
};

/** Handset outright prices by model and memory (one-time, USD cents). */
export const DEVICE_OUTRIGHT: Record<string, Record<string, number>> = {
  'malva-offer-phone-nova-5g': { '128': 49900, '256': 54900 },
  'malva-offer-phone-nova-pro': { '256': 79900, '512': 89900 },
};

// ---------------------------------------------------------------------------------------------------------------
// Handset financing (D-015, D-060): one recurrence policy per mode and term, because a price has one policy.

export const INSTALLMENT_TERMS = [12, 24, 36] as const;
export const LEASE_TERM = 24;
/** Monthly lease amount as a share of the outright price. */
export const LEASE_RATE = 0.04;

export function installmentPolicy(termMonths: number): string {
  return `malva-device-installment-${termMonths}`;
}
export const LEASE_POLICY = `malva-device-lease-${LEASE_TERM}`;

export function installmentCents(outrightCents: number, termMonths: number): number {
  return Math.round(outrightCents / termMonths);
}
export function leaseCents(outrightCents: number): number {
  return Math.round(outrightCents * LEASE_RATE);
}

/** Recurring prices of one handset variant for all financed modes: installments 12/24/36 and lease 24. */
export function financedPrices(outrightCents: number): PriceSpec[] {
  return [
    ...INSTALLMENT_TERMS.flatMap((term) => monthlyPrices(installmentCents(outrightCents, term), installmentPolicy(term))),
    ...monthlyPrices(leaseCents(outrightCents), LEASE_POLICY),
  ];
}

/** Every recurrence policy a variant with these prices is sold with. */
export function policiesOf(prices: PriceSpec[]): string[] {
  return [...new Set(prices.flatMap((p) => (p.recurrencePolicy ? [p.recurrencePolicy] : [])))];
}
