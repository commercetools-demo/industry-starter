import { QUANTITY_RULES } from '@/lib/config/cart';
import type { BlockedAdd, Offer } from '@/lib/types';

export type QuantityRule = { min: number; max: number };

/** Phone plans take 1-5 lines (D-014); every other plan, equipment and (until Q refines it) devices follow QUANTITY_RULES. */
export function quantityRuleFor(offer: Offer): QuantityRule {
  if (offer.kind === 'base-package' || offer.kind === 'bundle') return offer.facts?.kind === 'plan' && offer.facts.family === 'phone' ? QUANTITY_RULES.plan_phone : QUANTITY_RULES.plan_other;
  if (offer.kind === 'addon') return QUANTITY_RULES.addon;
  if (offer.kind === 'equipment') return QUANTITY_RULES.equipment;
  return QUANTITY_RULES.device;
}

const reason = (code: string, messageKey: string, offer: Offer, params: Record<string, string | number>): BlockedAdd['reasons'][number] => ({
  code,
  messageKey,
  params: { name: offer.name, ...params },
  offerKeys: [offer.key],
});

/** `null` when the quantity is allowed; otherwise the refusal (kind `limit`, reason QUANTITY_OUT_OF_RANGE or QUANTITY_FIXED). */
export function checkQuantity(offer: Offer, quantity: number): BlockedAdd | null {
  const rule = quantityRuleFor(offer);
  if (Number.isInteger(quantity) && quantity >= rule.min && quantity <= rule.max) return null;
  const fixed = rule.max === 1 && Number.isInteger(quantity) && quantity > 1;
  return { kind: 'limit', offerKey: offer.key, reasons: [
      fixed ? reason('QUANTITY_FIXED', 'bundle.blocked.quantityFixed', offer, { min: rule.min, max: rule.max }) : reason('QUANTITY_OUT_OF_RANGE', 'bundle.blocked.quantityRange', offer, { min: rule.min, max: rule.max }),
    ],
  };
}
