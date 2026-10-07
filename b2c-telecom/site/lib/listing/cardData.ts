import { MAX_BULLETS } from '@/lib/config/listing';
import { MAX_PHONE_LINES } from '@/lib/config/cart';
import { planChipId } from '@/lib/listing/facets';
import type { Money, Offer, PlanFamily, TermKey, TermMonths } from '@/lib/types';

/** One contract term of a plan card (a variant of the offer). `price` null = no monthly price for this buyer's market. */
export interface TermOption {
  sku: string;
  term: TermKey | null;
  termMonths: TermMonths;
  price: Money | null;
  isMaster: boolean;
}

/** Everything a plan card prints, derived from one offer (plain data, safe for a client component). */
export interface PlanCardData {
  key: string;
  name: string;
  family: PlanFamily | null;
  /** The chip the plan belongs to ("5g", "up-to-500", "unlimited"): the card's own label (D-017). */
  chipId: string | null;
  mostPopular: boolean;
  bullets: string[];
  /** In ascending order of months; the master variant is the initial choice. */
  terms: TermOption[];
  masterSku: string;
  /** 1 for everything but phone plans (D-014). */
  maxLines: number;
}

/** Message key of the term of a variant (`offers.term.*`). */
export function termKey(termMonths: TermMonths): 'month-to-month' | '12-months' | '24-months' {
  return termMonths === 0 ? 'month-to-month' : termMonths === 12 ? '12-months' : '24-months';
}

export function toPlanCardData(offer: Offer): PlanCardData {
  const facts = offer.facts?.kind === 'plan' ? offer.facts : null;
  const terms: TermOption[] = offer.variants
    .map((variant) => ({
      sku: variant.sku,
      term: variant.term,
      termMonths: variant.termMonths ?? 0,
      price: variant.recurringPrice ?? null,
      isMaster: variant.isMaster,
    }))
    .sort((a, b) => a.termMonths - b.termMonths);
  const master = offer.variants.find((variant) => variant.isMaster) ?? offer.variants[0];
  return {
    key: offer.key,
    name: offer.name,
    family: facts?.family ?? null,
    chipId: planChipId(offer),
    mostPopular: facts?.badge === 'most-popular',
    bullets: (facts?.highlights ?? []).slice(0, MAX_BULLETS),
    terms,
    masterSku: master?.sku ?? '',
    maxLines: facts?.family === 'phone' ? MAX_PHONE_LINES : 1,
  };
}

/** The add-on card's price: monthly when the master variant has one, else the one-time amount. */
export function addonPrice(offer: Offer): { amount: Money; recurring: boolean } | null {
  const master = offer.variants.find((variant) => variant.isMaster) ?? offer.variants[0];
  if (master?.recurringPrice) return { amount: master.recurringPrice, recurring: true };
  if (master?.oneTimePrice) return { amount: master.oneTimePrice, recurring: false };
  return null;
}
