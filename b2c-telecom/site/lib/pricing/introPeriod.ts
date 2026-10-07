// Introductory-period rules (spec introductory-period-price; D-023: the period starts at the order date). Pure: no I/O.
import { INTRO_DEFS, INTRO_DISCOUNT_KEY_PREFIX, type IntroDef } from '@/lib/config/pricing';
import type { Money, ScheduleError, TermMonths } from '@/lib/types';
import { addDays, addMonths, diffDays } from './dates';

export interface IntroPeriod {
  /** Promotional monthly amount per unit. */
  amount: Money;
  /** Standing monthly amount per unit once the period ends. */
  standing: Money;
  months: number;
  startsOn: string;
  /** First day of the standing price. */
  endsOn: string;
}

export function introDefFor(offerKey: string, term: TermMonths): IntroDef | null {
  return INTRO_DEFS.find((def) => def.offerKey === offerKey && def.term === term) ?? null;
}

type IntroResult = { ok: true; value: IntroPeriod } | { ok: false; error: ScheduleError };

export function computeIntro(args: { def: IntroDef; standing: Money; orderDate: string }): IntroResult {
  const { def, standing, orderDate } = args;
  const cents = (def.amountCents as Record<string, number | undefined>)[standing.currencyCode];
  if (cents === undefined) return { ok: false, error: { code: 'NO_STANDING_PRICE', detail: 'currency' } };
  if (cents >= standing.centAmount) return { ok: false, error: { code: 'INTRO_NOT_BELOW_STANDING', detail: String(cents) } };
  try {
    return {
      ok: true,
      value: {
        amount: { centAmount: cents, currencyCode: standing.currencyCode },
        standing,
        months: def.months,
        startsOn: orderDate,
        endsOn: addMonths(orderDate, def.months),
      },
    };
  } catch {
    return { ok: false, error: { code: 'BAD_DATE', detail: orderDate } };
  }
}

export function isIntroActive(intro: Pick<IntroPeriod, 'endsOn'>, today: string): boolean {
  return today < intro.endsOn;
}

/** The standing price applies from `endsOn` with no customer action. */
export function amountOn(intro: IntroPeriod, date: string): Money {
  return isIntroActive(intro, date) ? intro.amount : intro.standing;
}

/** Operator bears a provisioning delay: the end date moves later by the days of delay, never earlier. */
export function shiftForDelay(intro: IntroPeriod, expectedServiceStart: string, actualServiceStart: string): IntroPeriod {
  const delay = Math.max(0, diffDays(expectedServiceStart, actualServiceStart));
  return delay === 0 ? intro : { ...intro, endsOn: addDays(intro.endsOn, delay) };
}

/**
 * Before the stored service-start date the whole order is cancelled and nothing is owed (D-040); after it the savings already
 * received are not clawed back. Either way nothing is owed for the promotion.
 */
export function resolveEarlyCancellation(args: {
  cancelledOn: string;
  serviceStartDate: string;
  intro: IntroPeriod | null;
  currencyCode?: string;
}): { windowOpen: boolean; owedForPromo: Money; rule: 'cancel-before-service-start' | 'no-clawback' } {
  const windowOpen = args.cancelledOn < args.serviceStartDate;
  const currencyCode = args.intro?.amount.currencyCode ?? args.currencyCode ?? 'USD';
  return { windowOpen, owedForPromo: { centAmount: 0, currencyCode }, rule: windowOpen ? 'cancel-before-service-start' : 'no-clawback' };
}

/** 'malva-cd-intro-wireless-5g-12' */
export function discountKeyFor(def: IntroDef): string {
  return `${INTRO_DISCOUNT_KEY_PREFIX}${def.offerKey.replace(/^malva-offer-/, '')}-${def.term}`;
}
