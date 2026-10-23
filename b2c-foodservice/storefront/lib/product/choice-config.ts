/**
 * Variant attributes that force a choice before a product can be added (spec "Required choice").
 * Keyed by attribute name so the card needs no product type read: coffee varies by grind, machines and accessories by
 * colour. The choice is required only when the product has more than one distinct value of the attribute.
 */
export const CHOICE_ATTRIBUTES = { grind: 'grind', colour: 'colour' } as const satisfies Record<string, 'grind' | 'colour'>;
