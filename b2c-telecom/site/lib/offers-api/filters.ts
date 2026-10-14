/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { OffersApiError } from './errors';
import { isCustomerType } from '@/lib/offers/declared';
import { normalizePostalCode } from '@/lib/offers/serviceability';
import type { CustomerType, Offer, OfferKind } from '@/lib/types';

// Pure. The query of GET /api/offers: every value is checked and an unknown one is an error, never silently dropped.

export const OFFER_KINDS: readonly OfferKind[] = ['base-package', 'addon', 'equipment', 'device', 'bundle'];
export const API_FAMILIES = ['phone', 'home-wireless', 'cable'] as const;
export type ApiFamily = (typeof API_FAMILIES)[number];

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface OfferFilters {
  kind?: OfferKind;
  family?: ApiFamily;
  customerType?: CustomerType;
  existingCustomer?: boolean;
  /** Normalised 5-digit ZIP. */
  postalCode?: string;
  limit: number;
  offset: number;
}

const bad = (field: string, message: string): OffersApiError => new OffersApiError('INVALID_FILTER', message, { field });

function whole(raw: string, field: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw)) throw bad(field, `${field} must be a whole number.`);
  const value = Number(raw);
  if (value < min || value > max) throw bad(field, `${field} must be between ${min} and ${max}.`);
  return value;
}

export function parseFilters(params: URLSearchParams, country: 'US' | 'DE'): OfferFilters {
  const kind = params.get('kind');
  const family = params.get('family');
  const customerType = params.get('customerType');
  const existing = params.get('existingCustomer');
  const postalCode = params.get('postalCode');
  const filters: OfferFilters = { limit: DEFAULT_LIMIT, offset: 0 };

  if (kind !== null) {
    if (!(OFFER_KINDS as readonly string[]).includes(kind)) throw bad('kind', `kind must be one of ${OFFER_KINDS.join(', ')}.`);
    filters.kind = kind as OfferKind;
  }
  if (family !== null) {
    if (!(API_FAMILIES as readonly string[]).includes(family)) throw bad('family', `family must be one of ${API_FAMILIES.join(', ')}.`);
    filters.family = family as ApiFamily;
  }
  if (customerType !== null) {
    if (!isCustomerType(customerType)) throw bad('customerType', 'customerType must be one of consumer, small-business, employee.');
    filters.customerType = customerType;
  }
  if (existing !== null) {
    if (existing !== 'true' && existing !== 'false') throw bad('existingCustomer', 'existingCustomer must be true or false.');
    filters.existingCustomer = existing === 'true';
  }
  if (postalCode !== null) {
    const normalised = normalizePostalCode(postalCode, country);
    if (normalised === null) throw bad('postalCode', 'postalCode must be a valid ZIP code.');
    filters.postalCode = normalised;
  }
  const limit = params.get('limit');
  if (limit !== null) filters.limit = whole(limit, 'limit', 1, MAX_LIMIT);
  const offset = params.get('offset');
  if (offset !== null) filters.offset = whole(offset, 'offset', 0, 1_000_000);
  return filters;
}

/** The family label the API uses: a plan's own family, a technology for home internet. Add-ons and equipment have none of their own. */
export function apiFamilyOf(offer: Offer): ApiFamily | null {
  const facts = offer.facts;
  if (facts?.kind !== 'plan') return null;
  if (facts.family === 'phone') return 'phone';
  return facts.technology === 'cable' ? 'cable' : 'home-wireless';
}

/** Does the offer belong to the family? Plans by their own family; add-ons and equipment by the plans they work with. */
export function matchesFamily(offer: Offer, family: ApiFamily): boolean {
  const own = apiFamilyOf(offer);
  if (own !== null) return own === family;
  const facts = offer.facts;
  if (facts?.kind === 'addon') {
    const wanted = family === 'phone' ? 'phone' : 'internet';
    if (!facts.appliesToFamilies.includes(wanted)) return false;
    return family === 'phone' || facts.appliesToTechnologies.length === 0 || facts.appliesToTechnologies.includes(family === 'cable' ? 'cable' : 'fixed-wireless');
  }
  if (facts?.kind === 'equipment') return family !== 'phone' && facts.supportedTechnologies.includes(family === 'cable' ? 'cable' : 'fixed-wireless');
  if (facts?.kind === 'device') return family === 'phone';
  return false;
}
