// The phased price schedule record (spec term-phased-price-schedule; D-013): built once at commitment from the order date,
// stored on the order and never recomputed from catalog state. Pure: no I/O, no clock (callers pass dates).
import { INTRO_DEFS, STEP_DEFS, type StepDef } from '@/lib/config/pricing';
import type { Money, PeriodKind, PriceSchedule, ScheduleError, SchedulePeriod, ScheduleResult, TermMonths } from '@/lib/types';
import { addDays, addMonths, parseDateOnly } from './dates';
import { computeIntro } from './introPeriod';
import { priceModeForTerm } from './priceMode';

export interface ScheduleInput {
  offerKey: string;
  sku: string;
  termMonths: number;
  quantity: number;
  /** Per unit recurring list price (before the intro discount). */
  standing: Money;
  /** The engine says the intro cart discount is on the line. */
  introApplied: boolean;
  /** Per unit price of the same offer's month-to-month variant (after-term price). */
  monthToMonth: Money | null;
  /** One-time fees attributed to this line in total (activation fee x quantity); centAmount 0 if none. */
  oneTimeDueNow: Money;
  /** YYYY-MM-DD. */
  orderDate: string;
}

const OPEN_END = '9999-12-31';

const fail = (code: ScheduleError['code'], detail?: string): { ok: false; error: ScheduleError } => ({ ok: false, error: { code, ...(detail !== undefined ? { detail } : {}) } });

interface Segment {
  months: number; // 0 = open-ended
  amount: Money;
  kind: PeriodKind;
}

const money = (centAmount: number, currencyCode: string): Money => ({ centAmount, currencyCode });

function isCommittedTerm(term: number): term is 12 | 24 {
  return term === 12 || term === 24;
}

/** Step definition for the offer: the exact term first, else any definition of the offer (so a longer term is reported as not priced). */
function stepDefFor(offerKey: string, term: number): StepDef | null {
  return STEP_DEFS.find((d) => d.offerKey === offerKey && d.term === term) ?? STEP_DEFS.find((d) => d.offerKey === offerKey) ?? null;
}

function deltaFor(def: StepDef, fromMonth: number, currencyCode: string): number | undefined {
  const step = def.steps.find((s) => s.fromMonth === fromMonth);
  return step ? (step.deltaCents as Record<string, number | undefined>)[currencyCode] : undefined;
}

/** Segments for a stepped term: standing until the first step, then standing + delta from each step to the next. */
function stepSegments(def: StepDef, standing: Money, term: number): Segment[] | ScheduleError {
  const steps = [...def.steps].sort((a, b) => a.fromMonth - b.fromMonth);
  const segments: Segment[] = [];
  const firstFrom = steps[0]?.fromMonth ?? term + 1;
  if (firstFrom - 1 > 0) segments.push({ months: Math.min(firstFrom - 1, term), amount: standing, kind: 'standing' });
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] as StepDef['steps'][number];
    if (step.fromMonth > term) break;
    const delta = deltaFor(def, step.fromMonth, standing.currencyCode);
    if (delta === undefined) return { code: 'NO_STANDING_PRICE', detail: 'currency' };
    const until = Math.min(steps[i + 1]?.fromMonth !== undefined ? (steps[i + 1] as StepDef['steps'][number]).fromMonth - 1 : term, term);
    segments.push({ months: until - step.fromMonth + 1, amount: money(standing.centAmount + delta, standing.currencyCode), kind: 'step' });
  }
  return segments;
}

/** Periods for consecutive segments starting at billing month `startMonth`; indexes start after `indexOffset`. */
function toPeriods(segments: Segment[], orderDate: string, startMonth = 1, indexOffset = 0): SchedulePeriod[] {
  let from = startMonth;
  return segments.map((segment, i) => {
    const openEnded = segment.months === 0;
    const toMonth = openEnded ? 0 : from + segment.months - 1;
    const period: SchedulePeriod = {
      index: indexOffset + i + 1,
      fromMonth: from,
      toMonth,
      months: segment.months,
      startsOn: addMonths(orderDate, from - 1),
      endsOn: openEnded ? OPEN_END : addDays(addMonths(orderDate, toMonth), -1),
      monthlyAmount: segment.amount,
      kind: segment.kind,
    };
    from = toMonth + 1;
    return period;
  });
}

function sumTerm(periods: SchedulePeriod[], quantity: number, currencyCode: string): Money {
  return money(periods.reduce((total, p) => total + p.months * p.monthlyAmount.centAmount, 0) * quantity, currencyCode);
}

export function buildSchedule(input: ScheduleInput, today?: string): ScheduleResult {
  const { offerKey, sku, termMonths, quantity, standing, orderDate } = input;
  if (parseDateOnly(orderDate) === null || (today !== undefined && orderDate > today)) return fail('BAD_DATE', orderDate);
  if (standing.centAmount <= 0) return fail('NO_STANDING_PRICE');
  const currency = standing.currencyCode;
  const introDef = INTRO_DEFS.find((d) => d.offerKey === offerKey && d.term === termMonths) ?? null;
  const openEnded = termMonths === 0;
  let segments: Segment[];

  if (openEnded) {
    segments = [{ months: 0, amount: standing, kind: 'standing' }];
  } else if (isCommittedTerm(termMonths)) {
    segments = [{ months: termMonths, amount: standing, kind: 'standing' }];
  } else {
    const def = stepDefFor(offerKey, termMonths);
    return fail('PERIOD_NOT_PRICED', def && def.coversMonths < termMonths ? String(def.coversMonths + 1) : 'term');
  }

  const stepDef = openEnded ? null : stepDefFor(offerKey, termMonths);
  if (stepDef) {
    if (termMonths > stepDef.coversMonths) return fail('PERIOD_NOT_PRICED', String(stepDef.coversMonths + 1));
    const stepped = stepSegments(stepDef, standing, termMonths);
    if (!Array.isArray(stepped)) return { ok: false, error: stepped };
    segments = stepped;
  }

  if (introDef && input.introApplied) {
    const intro = computeIntro({ def: introDef, standing, orderDate });
    if (!intro.ok) return intro;
    if (!openEnded && introDef.months >= termMonths) return fail('PERIOD_NOT_PRICED', String(introDef.months));
    const rest: Segment[] = openEnded ? segments : [{ months: termMonths - introDef.months, amount: standing, kind: 'standing' }];
    segments = [{ months: introDef.months, amount: intro.value.amount, kind: 'intro' }, ...rest];
  }

  const periods = toPeriods(segments, orderDate);
  let afterTerm: PriceSchedule['afterTerm'] = null;
  if (!openEnded) {
    if (!input.monthToMonth) return fail('NO_STANDING_PRICE', 'afterTerm');
    afterTerm = { startsOn: addMonths(orderDate, termMonths), monthlyAmount: input.monthToMonth, basis: 'month-to-month-price' };
  }
  const first = periods[0] as SchedulePeriod;
  const schedule: PriceSchedule = {
    v: 1,
    offerKey,
    sku,
    termMonths: termMonths as TermMonths,
    quantity,
    currencyCode: currency,
    priceMode: priceModeForTerm(termMonths as TermMonths),
    orderDate,
    periods,
    openEnded,
    totalContractValue: openEnded ? null : sumTerm(periods, quantity, currency),
    dueAtOrder: money(first.monthlyAmount.centAmount * quantity + input.oneTimeDueNow.centAmount, currency),
    afterTerm,
    introEndsOn: first.kind === 'intro' ? addDays(first.endsOn, 1) : null,
    status: 'active',
  };
  return { ok: true, value: schedule };
}

/** Sum over the term x quantity; null for an open-ended schedule. */
export function totalContractValue(s: PriceSchedule): Money | null {
  return s.openEnded ? null : sumTerm(s.periods, s.quantity, s.currencyCode);
}

export function periodOn(s: PriceSchedule, date: string): SchedulePeriod | null {
  return s.periods.find((p) => p.startsOn <= date && date <= p.endsOn) ?? null;
}

/** Per unit: the period's amount, the after-term amount once the term is over, otherwise zero (before the order date). */
export function amountDueOn(s: PriceSchedule, date: string): Money {
  const period = periodOn(s, date);
  if (period) return period.monthlyAmount;
  if (s.afterTerm && date >= s.afterTerm.startsOn) return s.afterTerm.monthlyAmount;
  return money(0, s.currencyCode);
}

/** Whole billing months elapsed on `date` (0 before the first month ends). */
function monthsElapsed(orderDate: string, date: string, cap: number): number {
  let k = 0;
  while (k < cap && addMonths(orderDate, k + 1) <= date) k += 1;
  return k;
}

/** Whole billing months left in the term (0 when open-ended): the input of the early-termination formula. */
export function monthsRemaining(s: PriceSchedule, date: string): number {
  if (s.openEnded) return 0;
  if (date < s.orderDate) return s.termMonths;
  return Math.max(0, s.termMonths - monthsElapsed(s.orderDate, date, s.termMonths));
}

/** Remaining periods are void (never billed); history stays as agreed. */
export function cancelSchedule(s: PriceSchedule, cancelledOn: string): PriceSchedule {
  return { ...s, status: 'cancelled', cancelledOn };
}

/** The old version after an amendment. */
export function markAmended(s: PriceSchedule, amendedOn: string): PriceSchedule {
  return { ...s, status: 'amended', amendedOn };
}

/**
 * Reprices the remainder from the amendment date: months already begun stay as agreed, an intro period is a promise and stays whole,
 * the remaining months take the new standing price (plus the step definitions for months not yet elapsed). Never creates a new intro.
 */
export function amendFrom(s: PriceSchedule, amendedOn: string, newStanding: Money): ScheduleResult {
  if (parseDateOnly(amendedOn) === null || amendedOn < s.orderDate || s.status !== 'active') return fail('BAD_DATE', amendedOn);
  if (newStanding.centAmount <= 0) return fail('NO_STANDING_PRICE');
  const cap = s.openEnded ? 1200 : s.termMonths;
  const current = monthsElapsed(s.orderDate, amendedOn, cap) + 1; // the billing month that contains the amendment date
  if (!s.openEnded && current > s.termMonths) return fail('BAD_DATE', 'after-term');

  const kept: SchedulePeriod[] = [];
  for (const period of s.periods) {
    if (period.kind === 'intro') kept.push(period);
    else if (period.fromMonth < current) kept.push(period.toMonth !== 0 && period.toMonth < current ? period : truncate(period, current - 1, s.orderDate));
  }
  const keptThrough = kept.reduce((max, p) => Math.max(max, p.toMonth), 0);
  const from = keptThrough + 1;
  const remaining: Segment[] = [];
  if (s.openEnded) {
    remaining.push({ months: 0, amount: newStanding, kind: 'standing' });
  } else {
    const def = stepDefFor(s.offerKey, s.termMonths);
    const groups: { amount: number; kind: PeriodKind; months: number }[] = [];
    for (let month = from; month <= s.termMonths; month += 1) {
      const step = def?.steps.filter((st) => st.fromMonth <= month).sort((a, b) => b.fromMonth - a.fromMonth)[0];
      const delta = step ? ((step.deltaCents as Record<string, number | undefined>)[newStanding.currencyCode] ?? 0) : 0;
      const kind: PeriodKind = delta > 0 ? 'step' : 'standing';
      const amount = newStanding.centAmount + delta;
      const last = groups[groups.length - 1];
      if (last && last.amount === amount && last.kind === kind) last.months += 1;
      else groups.push({ amount, kind, months: 1 });
    }
    for (const group of groups) remaining.push({ months: group.months, amount: money(group.amount, newStanding.currencyCode), kind: group.kind });
  }

  const tail = toPeriods(remaining, s.orderDate, from, kept.length);
  const periods = [...kept.map((p, i) => ({ ...p, index: i + 1 })), ...tail];
  const next: PriceSchedule = {
    ...s,
    periods,
    totalContractValue: s.openEnded ? null : sumTerm(periods, s.quantity, s.currencyCode),
    status: 'active',
    amendedOn,
    supersedes: s.amendedOn ?? s.orderDate,
  };
  delete next.cancelledOn;
  return { ok: true, value: next };
}

function truncate(period: SchedulePeriod, toMonth: number, orderDate: string): SchedulePeriod {
  return { ...period, toMonth, months: toMonth - period.fromMonth + 1, endsOn: addDays(addMonths(orderDate, toMonth), -1) };
}

export function serializeSchedules(list: PriceSchedule[]): string {
  return JSON.stringify({ v: 1, schedules: list });
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isMoney = (value: unknown): value is Money => isRecord(value) && Number.isInteger(value.centAmount) && typeof value.currencyCode === 'string';
const isDate = (value: unknown): value is string => typeof value === 'string' && parseDateOnly(value) !== null;

function isPeriod(value: unknown): value is SchedulePeriod {
  return (
    isRecord(value) &&
    Number.isInteger(value.index) &&
    Number.isInteger(value.fromMonth) &&
    Number.isInteger(value.toMonth) &&
    Number.isInteger(value.months) &&
    typeof value.startsOn === 'string' &&
    typeof value.endsOn === 'string' &&
    isMoney(value.monthlyAmount) &&
    (value.kind === 'intro' || value.kind === 'standing' || value.kind === 'step')
  );
}

function isSchedule(value: unknown): value is PriceSchedule {
  return (
    isRecord(value) &&
    value.v === 1 &&
    typeof value.offerKey === 'string' &&
    typeof value.sku === 'string' &&
    Number.isInteger(value.termMonths) &&
    Number.isInteger(value.quantity) &&
    typeof value.currencyCode === 'string' &&
    (value.priceMode === 'Fixed' || value.priceMode === 'Dynamic') &&
    isDate(value.orderDate) &&
    Array.isArray(value.periods) &&
    value.periods.every(isPeriod) &&
    typeof value.openEnded === 'boolean' &&
    (value.totalContractValue === null || isMoney(value.totalContractValue)) &&
    isMoney(value.dueAtOrder) &&
    (value.afterTerm === null || (isRecord(value.afterTerm) && typeof value.afterTerm.startsOn === 'string' && isMoney(value.afterTerm.monthlyAmount))) &&
    (value.introEndsOn === null || typeof value.introEndsOn === 'string') &&
    (value.status === 'active' || value.status === 'cancelled' || value.status === 'amended')
  );
}

export function parseSchedules(json: string): { ok: true; value: PriceSchedule[] } | { ok: false; error: 'BAD_JSON' | 'BAD_VERSION' | 'BAD_SHAPE' } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'BAD_JSON' };
  }
  if (!isRecord(data)) return { ok: false, error: 'BAD_SHAPE' };
  if (data.v !== 1) return { ok: false, error: 'BAD_VERSION' };
  if (!Array.isArray(data.schedules) || !data.schedules.every(isSchedule)) return { ok: false, error: 'BAD_SHAPE' };
  return { ok: true, value: data.schedules };
}

/**
 * Boundaries that fall due on `today` (a report for a future billing integration or an operator, D-059): intro ends, a step
 * begins, the term ends (the after-term price starts). Cancelled and amended schedules are ignored.
 */
export function dueTransitions(
  list: { orderNumber: string; schedule: PriceSchedule }[],
  today: string,
): { orderNumber: string; sku: string; kind: 'intro-ends' | 'step' | 'term-ends'; on: string; newAmount: Money }[] {
  const out: { orderNumber: string; sku: string; kind: 'intro-ends' | 'step' | 'term-ends'; on: string; newAmount: Money }[] = [];
  for (const { orderNumber, schedule } of list) {
    if (schedule.status !== 'active') continue;
    schedule.periods.forEach((period, i) => {
      const next = schedule.periods[i + 1];
      if (next && next.startsOn === today) {
        out.push({ orderNumber, sku: schedule.sku, kind: period.kind === 'intro' ? 'intro-ends' : 'step', on: today, newAmount: next.monthlyAmount });
      }
    });
    if (schedule.afterTerm && schedule.afterTerm.startsOn === today) {
      out.push({ orderNumber, sku: schedule.sku, kind: 'term-ends', on: today, newAmount: schedule.afterTerm.monthlyAmount });
    }
  }
  return out;
}
