// Totals of the device lines of a bundle, stated per acquisition mode (Mixed modes in one order). Pure.
import type { AcquisitionMode, CartLine, Money } from '@/lib/types';

export interface ModeTotals {
  mode: AcquisitionMode;
  /** Number of devices (sum of quantities). */
  count: number;
  /** What is charged at checkout for the lines of this mode (the engine's line totals). */
  dueNow: Money;
  /** Monthly amount of the lines of this mode after today's payment: zero for outright. */
  monthly: Money;
}

const ORDER: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];

/** One entry per mode that occurs, in the fixed order outright, installments, lease. Lines without an acquisition are ignored. */
export function summarizeByMode(lines: readonly CartLine[]): ModeTotals[] {
  const totals = new Map<AcquisitionMode, ModeTotals>();
  for (const line of lines) {
    if (!line.acquisition) continue;
    const { mode } = line.acquisition;
    const currencyCode = line.total.currencyCode;
    const entry = totals.get(mode) ?? { mode, count: 0, dueNow: { centAmount: 0, currencyCode }, monthly: { centAmount: 0, currencyCode } };
    entry.count += line.quantity;
    entry.dueNow = { centAmount: entry.dueNow.centAmount + line.total.centAmount, currencyCode };
    if (mode !== 'outright') entry.monthly = { centAmount: entry.monthly.centAmount + line.total.centAmount, currencyCode };
    totals.set(mode, entry);
  }
  return ORDER.flatMap((mode) => {
    const entry = totals.get(mode);
    return entry ? [entry] : [];
  });
}
