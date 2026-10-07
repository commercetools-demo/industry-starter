import { buildCandidateList } from '@/lib/offers/compat';
import type { CartLine, EquipmentKind, Money, Offer, Reason } from '@/lib/types';

// What a plan card's pickers show. The rules are J's (`buildCandidateList` wraps `evaluateCandidate`, pure, shared with the server,
// D-024); this file only turns a verdict into a row state. The server re-checks every add, so a row that looks selectable here is
// never trusted by the cart.

export type ChoiceState =
  /** Can be added now (when the plan is in the bundle). */
  | 'selectable'
  /** Already on this plan: shown checked, can be removed. */
  | 'attached'
  /** The plan includes it in its price: shown checked and disabled with "Included". */
  | 'included'
  /** Shown disabled with the reason (never hidden: speed, technology, declared incompatibility). */
  | 'disabled';

export interface AddonChoice {
  offer: Offer;
  state: ChoiceState;
  reason?: Reason;
  attachedLine?: CartLine;
}

/** Add-ons for another plan family are not listed at all (J). Input order is kept. */
export function computeAddonChoices(plan: Offer, addons: Offer[], attachedLines: CartLine[]): AddonChoice[] {
  return buildCandidateList(
    plan,
    addons,
    attachedLines.map((line) => line.offerKey),
  ).map(({ offer, verdict }) => {
    const attachedLine = attachedLines.find((line) => line.offerKey === offer.key);
    if (attachedLine) return { offer, state: 'attached', attachedLine };
    if (verdict.status === 'included') return { offer, state: 'included' };
    if (verdict.status === 'allowed') return { offer, state: 'selectable' };
    return { offer, state: 'disabled', ...(verdict.reasons[0] ? { reason: verdict.reasons[0] } : {}) };
  });
}

export interface EquipmentVariantChoice {
  sku: string;
  mode: 'rental' | 'purchase';
  price: Money;
}
export interface EquipmentChoice {
  offer: Offer;
  state: ChoiceState;
  reason?: Reason;
  variants: EquipmentVariantChoice[];
  /** The line of this offer on the plan (its `sku` says which variant). */
  attachedLine?: CartLine;
}
export interface EquipmentGroup {
  kind: EquipmentKind;
  choices: EquipmentChoice[];
}

const kindOf = (offer: Offer): EquipmentKind | undefined => (offer.facts?.kind === 'equipment' ? offer.facts.equipmentKind : undefined);

/** Rental (monthly price) before purchase (one-time price), in variant order. A variant without any price is not offered. */
export function equipmentVariants(offer: Offer): EquipmentVariantChoice[] {
  return offer.variants.flatMap((variant): EquipmentVariantChoice[] => {
    if (variant.recurringPrice) return [{ sku: variant.sku, mode: 'rental', price: variant.recurringPrice }];
    if (variant.oneTimePrice) return [{ sku: variant.sku, mode: 'purchase', price: variant.oneTimePrice }];
    return [];
  });
}

/** Equipment grouped by kind (router, modem, ...) in the order of the first appearance. Equipment of no known kind is left out. */
export function computeEquipmentChoices(plan: Offer, equipment: Offer[], attachedLines: CartLine[]): EquipmentGroup[] {
  const groups = new Map<EquipmentKind, EquipmentChoice[]>();
  for (const { offer, verdict } of buildCandidateList(
    plan,
    equipment,
    attachedLines.map((line) => line.offerKey),
  )) {
    const kind = kindOf(offer);
    if (!kind) continue;
    const attachedLine = attachedLines.find((line) => line.offerKey === offer.key);
    const base = { offer, variants: equipmentVariants(offer) };
    const choice: EquipmentChoice = attachedLine
      ? { ...base, state: 'attached', attachedLine }
      : verdict.status === 'included'
        ? { ...base, state: 'included' }
        : verdict.status === 'allowed'
          ? { ...base, state: 'selectable' }
          : { ...base, state: 'disabled', ...(verdict.reasons[0] ? { reason: verdict.reasons[0] } : {}) };
    groups.set(kind, [...(groups.get(kind) ?? []), choice]);
  }
  return [...groups].map(([kind, choices]) => ({ kind, choices }));
}
