// Broadband Facts label builder (spec broadband-facts-label). Pure: the ONLY place where label fields are mapped from
// catalog data. Nothing is copied: every figure comes from the offer, the line's engine prices and the price schedule.
import { DISCOUNT_AMOUNTS } from '@/lib/config/discounts';
import type { BroadbandLabelData, BundleLineKind, LabelRow, LabelSnapshot, Money, Offer, PriceSchedule, TermMonths } from '@/lib/types';

/** Message texts of the `label` namespace (identical English in both locales). */
export interface LabelStrings {
  kind: { cable: string; wireless: string; phone: string };
  activationFee: string;
  lock: string;
  noLock: string;
  intro: string;
  step: string;
  perMonth: string;
  unlimited: string;
  gb: string;
  mbps: string;
  ms: string;
  download: string;
  upload: string;
  latency: string;
  discounts: { cable: string; wireless: string; phone: string };
}

export interface LabelBuildInput {
  /** The plan offer (facts.kind === 'plan'). */
  offer: Offer;
  line: { sku: string; quantity: number; termMonths: TermMonths; unitListPrice: Money; unitPrice: Money };
  /** The plan's one-time activation fee per line (0 allowed); null when the catalog has none defined. */
  activationFee: Money | null;
  children: { name: string; chargeType: 'recurring' | 'one-time'; kind: BundleLineKind; total: Money; quantity: number }[];
  schedule: PriceSchedule | null;
  strings: LabelStrings;
  /** Formats with en-US rules in the cart currency. */
  fmt: (money: Money) => string;
}

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));

/** `$59.99` / `€59.99`: always two fraction digits, en-US number rules (the label is a US disclosure format). */
export function formatLabelMoney(money: Money): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(money.centAmount / 100);
}

const amountOf = (money: Money, currencyCode: string): number => (money.currencyCode === currencyCode ? money.centAmount : 0);

function discountsText(offer: Offer, strings: LabelStrings, currency: string, fmt: LabelBuildInput['fmt']): string {
  const cur = currency === 'EUR' ? 'EUR' : 'USD';
  const values = {
    secondLine: fmt({ centAmount: DISCOUNT_AMOUNTS.secondLine[cur], currencyCode: currency }),
    bundle: fmt({ centAmount: DISCOUNT_AMOUNTS.bundleCablePhone[cur], currencyCode: currency }),
  };
  const facts = offer.facts?.kind === 'plan' ? offer.facts : null;
  if (facts?.family === 'phone') return fill(strings.discounts.phone, values);
  return fill(facts?.technology === 'cable' ? strings.discounts.cable : strings.discounts.wireless, values);
}

export function buildLabel(input: LabelBuildInput): { ok: true; label: BroadbandLabelData } | { ok: false; missing: string[] } {
  const { offer, line, children, schedule, strings, fmt, activationFee } = input;
  const facts = offer.facts?.kind === 'plan' ? offer.facts : null;
  if (!facts) return { ok: false, missing: ['plan-facts'] };
  const missing: string[] = [];
  if (facts.typicalDownloadMbps === undefined) missing.push('typical-download-mbps');
  if (facts.typicalUploadMbps === undefined) missing.push('typical-upload-mbps');
  if (facts.typicalLatencyMs === undefined) missing.push('typical-latency-ms');
  if (facts.dataGb === undefined) missing.push('data-gb');
  if (facts.priceLockMonths === undefined) missing.push('price-lock-months');
  if (facts.earlyTerminationFee === undefined || facts.earlyTerminationFee.trim() === '') missing.push('early-termination-fee');
  if (activationFee === null) missing.push('activation-fee');
  if (missing.length > 0 || activationFee === null) return { ok: false, missing };

  const currency = line.unitListPrice.currencyCode;
  const kindKey = facts.family === 'phone' ? 'phone' : facts.technology === 'cable' ? 'cable' : 'wireless';

  let priceNote = (facts.priceLockMonths ?? 0) > 0 ? fill(strings.lock, { months: facts.priceLockMonths ?? 0 }) : strings.noLock;
  const intro = schedule?.periods.find((period) => period.kind === 'intro');
  if (schedule && intro) {
    const standing = schedule.periods.find((period) => period.kind === 'standing') ?? schedule.periods.find((period) => period.index > intro.index);
    priceNote += ` ${fill(strings.intro, {
      amount: fmt(intro.monthlyAmount),
      months: intro.months,
      standing: fmt(standing?.monthlyAmount ?? line.unitListPrice),
    })}`;
  }
  const step = schedule?.periods.find((period) => period.kind === 'step');
  if (step) priceNote += ` ${fill(strings.step, { amount: fmt(step.monthlyAmount), month: step.fromMonth })}`;

  const monthlyFees: LabelRow[] = children
    .filter((child) => child.kind === 'equipment' && child.chargeType === 'recurring')
    .map((child) => ({ k: child.name, v: fill(strings.perMonth, { amount: fmt({ centAmount: Math.round(child.total.centAmount / Math.max(1, child.quantity)), currencyCode: currency }) }) }));
  const oneTime: LabelRow[] = [
    { k: strings.activationFee, v: fmt({ centAmount: amountOf(activationFee, currency), currencyCode: currency }) },
    ...children
      .filter((child) => child.kind !== 'fee' && child.chargeType === 'one-time')
      .map((child) => ({ k: child.name, v: fmt(child.total) })),
  ];

  return {
    ok: true,
    label: {
      id: line.sku,
      planName: offer.name,
      kind: strings.kind[kindKey],
      price: fmt(line.unitListPrice),
      priceNote,
      monthlyFees,
      oneTime,
      etf: facts.earlyTerminationFee ?? '',
      discounts: discountsText(offer, strings, currency, fmt),
      speeds: [
        { k: strings.download, v: fill(strings.mbps, { n: facts.typicalDownloadMbps ?? 0 }) },
        { k: strings.upload, v: fill(strings.mbps, { n: facts.typicalUploadMbps ?? 0 }) },
        { k: strings.latency, v: fill(strings.ms, { n: facts.typicalLatencyMs ?? 0 }) },
      ],
      data: facts.dataGb === -1 ? strings.unlimited : fill(strings.gb, { n: facts.dataGb ?? 0 }),
    },
  };
}

/** JSON text of a `LabelSnapshot` v1 (the order custom field `labelSnapshot`). */
export function buildLabelSnapshot(labels: LabelSnapshot['labels'], now: string, locale: string, currencyCode: string): string {
  const snapshot: LabelSnapshot = { v: 1, takenAt: now, locale, currencyCode, labels };
  return JSON.stringify(snapshot);
}

const isRows = (value: unknown): boolean =>
  Array.isArray(value) && value.every((row) => typeof row === 'object' && row !== null && typeof (row as LabelRow).k === 'string' && typeof (row as LabelRow).v === 'string');

function isLabel(value: unknown): value is BroadbandLabelData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    ['id', 'planName', 'kind', 'price', 'priceNote', 'etf', 'discounts', 'data'].every((name) => typeof v[name] === 'string') &&
    isRows(v.monthlyFees) &&
    isRows(v.oneTime) &&
    isRows(v.speeds)
  );
}

export function parseLabelSnapshot(json: string): { ok: true; value: LabelSnapshot } | { ok: false } {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return { ok: false };
    const v = parsed as Record<string, unknown>;
    if (v.v !== 1 || typeof v.takenAt !== 'string' || typeof v.locale !== 'string' || typeof v.currencyCode !== 'string' || !Array.isArray(v.labels)) return { ok: false };
    const labels = v.labels as unknown[];
    const valid = labels.every((entry) => {
      const e = entry as Record<string, unknown> | null;
      return typeof e === 'object' && e !== null && typeof e.sku === 'string' && typeof e.offerKey === 'string' && isLabel(e.label);
    });
    return valid ? { ok: true, value: v as unknown as LabelSnapshot } : { ok: false };
  } catch {
    return { ok: false };
  }
}
