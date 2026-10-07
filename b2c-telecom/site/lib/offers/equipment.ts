import type { EquipmentKind, EquipmentSelection, Offer, OfferVariant } from '@/lib/types';
import { evaluateCandidate } from './rules';

const isEquipment = (offer: Offer): boolean => offer.kind === 'equipment' && offer.facts?.kind === 'equipment';
const kindOf = (offer: Offer): EquipmentKind | undefined => (offer.facts?.kind === 'equipment' ? offer.facts.equipmentKind : undefined);

/** Equipment that may be sold with the plan (status `allowed` only; included equipment is not sold again). */
export function compatibleEquipmentFor(plan: Offer, equipmentOffers: Offer[]): Offer[] {
  return equipmentOffers.filter((offer) => isEquipment(offer) && evaluateCandidate(plan, offer).status === 'allowed');
}

/** Kinds the plan already includes in its price (a cable plan includes its modem): nothing to add or sell for them. */
export function includedEquipmentKinds(plan: Offer, equipmentOffers: Offer[]): EquipmentKind[] {
  const kinds = equipmentOffers.filter((offer) => isEquipment(offer) && evaluateCandidate(plan, offer).status === 'included').flatMap((offer) => kindOf(offer) ?? []);
  return [...new Set(kinds)];
}

interface Choice {
  selection: EquipmentSelection;
  rank: [number, number, string];
}

const cheapest = (variants: OfferVariant[], pick: (variant: OfferVariant) => number | undefined): { variant: OfferVariant; cents: number } | undefined => {
  let best: { variant: OfferVariant; cents: number } | undefined;
  for (const variant of variants) {
    const cents = pick(variant);
    if (cents !== undefined && (best === undefined || cents < best.cents)) best = { variant, cents };
  }
  return best;
};

function choiceFor(offer: Offer, kind: EquipmentKind): Choice | undefined {
  const rental = cheapest(offer.variants, (variant) => variant.recurringPrice?.centAmount);
  if (rental) return { selection: { kind, offerKey: offer.key, variantSku: rental.variant.sku, mode: 'rental' }, rank: [0, rental.cents, offer.key] };
  const purchase = cheapest(offer.variants, (variant) => variant.oneTimePrice?.centAmount);
  if (purchase) return { selection: { kind, offerKey: offer.key, variantSku: purchase.variant.sku, mode: 'purchase' }, rank: [1, purchase.cents, offer.key] };
  return undefined; // an offer without any price cannot be sold
}

const compareRank = (a: Choice['rank'], b: Choice['rank']): number => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);

/**
 * D-025: for every required kind (attribute order) the cheapest compatible equipment, rental before purchase, then price,
 * then offer key. A kind the plan already includes needs no line. A kind nothing can fulfil is `unfulfillable`.
 */
export function defaultEquipment(
  plan: Offer,
  equipmentOffers: Offer[],
): { selections: EquipmentSelection[]; unfulfillable: EquipmentKind[]; includedKinds: EquipmentKind[] } {
  const required = plan.facts?.kind === 'plan' ? plan.facts.requiredEquipmentKinds : [];
  const includedKinds = includedEquipmentKinds(plan, equipmentOffers);
  const compatible = compatibleEquipmentFor(plan, equipmentOffers);
  const selections: EquipmentSelection[] = [];
  const unfulfillable: EquipmentKind[] = [];
  for (const kind of required) {
    if (includedKinds.includes(kind)) continue;
    const choices = compatible.flatMap((offer) => (kindOf(offer) === kind ? (choiceFor(offer, kind) ?? []) : []));
    const best = choices.sort((a, b) => compareRank(a.rank, b.rank))[0];
    if (best) selections.push(best.selection);
    else unfulfillable.push(kind);
  }
  return { selections, unfulfillable, includedKinds };
}

/**
 * Kinds the plan requires that neither an attached equipment line nor an included equipment offer covers.
 * `equipmentOffers` (the catalog's equipment) is only needed to recognise included kinds.
 */
export function missingRequiredEquipment(plan: Offer, attachedEquipment: Offer[], equipmentOffers: Offer[] = []): EquipmentKind[] {
  const required = plan.facts?.kind === 'plan' ? plan.facts.requiredEquipmentKinds : [];
  const covered = new Set<EquipmentKind>([...includedEquipmentKinds(plan, equipmentOffers), ...attachedEquipment.flatMap((offer) => kindOf(offer) ?? [])]);
  return required.filter((kind) => !covered.has(kind));
}
