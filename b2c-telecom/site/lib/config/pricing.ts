// Demonstration data for introductory periods and stepped term prices (Planner default, owner may overrule).
// An offer + term appears in INTRO_DEFS or in STEP_DEFS, never both. Amounts are below the standing price and never 0.
export const MONTHLY_POLICY_KEY = 'malva-monthly' as const;

export interface IntroDef {
  offerKey: string;
  term: 0 | 12 | 24;
  months: number;
  amountCents: { USD: number; EUR: number };
}
export interface StepDef {
  offerKey: string;
  term: 12 | 24;
  coversMonths: number;
  steps: { fromMonth: number; deltaCents: { USD: number; EUR: number } }[];
}

export const INTRO_DEFS: IntroDef[] = [
  // Air 5G: 3 months at $35 / EUR 32, then the 12-month price ($55)
  { offerKey: 'malva-offer-wireless-5g', term: 12, months: 3, amountCents: { USD: 3500, EUR: 3200 } },
  // Cable 100: 6 months at $29.99, then $39.99
  { offerKey: 'malva-offer-cable-100', term: 24, months: 6, amountCents: { USD: 2999, EUR: 2799 } },
];

export const STEP_DEFS: StepDef[] = [
  // Unlimited 24-month: year 2 is $5 / EUR 4.50 more
  { offerKey: 'malva-offer-phone-unlimited', term: 24, coversMonths: 24, steps: [{ fromMonth: 13, deltaCents: { USD: 500, EUR: 450 } }] },
];

/** Cart Discount keys, one per IntroDef: malva-cd-intro-<offerKey-without-malva-offer->-<term>. */
export const INTRO_DISCOUNT_KEY_PREFIX = 'malva-cd-intro-';

/** Install lead time in days (D-023): expected service start = order date + lead. Cable 5, everything else 0. */
export const INSTALL_LEAD_DAYS_CABLE = 5;
