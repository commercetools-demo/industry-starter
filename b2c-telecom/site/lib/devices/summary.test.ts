import { deviceLine, usd } from './__fixtures__/devices';
import { summarizeByMode } from './summary';

describe('summarizeByMode', () => {
  it('Mixed modes in one order: totals are stated per mode and each line keeps its own mode and term', () => {
    const outright = deviceLine('l1', { mode: 'outright', termMonths: 0, endOfTerm: 'owned' }, usd(100800));
    const installments = deviceLine('l2', { mode: 'installments', termMonths: 24, endOfTerm: 'owned-after-final-payment' }, usd(4950), 1, { sku: 'MLV-DEV-NOVAPRO-SLV-512' });
    const totals = summarizeByMode([installments, outright]);
    expect(totals).toEqual([
      { mode: 'outright', count: 1, dueNow: usd(100800), monthly: usd(0) },
      { mode: 'installments', count: 1, dueNow: usd(4950), monthly: usd(4950) },
    ]);
    // the lines themselves are untouched: each keeps its own mode and term
    expect(installments.acquisition).toMatchObject({ mode: 'installments', termMonths: 24 });
    expect(outright.acquisition).toMatchObject({ mode: 'outright', termMonths: 0 });
  });
  it('sums quantities and totals of lines of the same mode and orders outright, installments, lease', () => {
    const a = deviceLine('a', { mode: 'lease', termMonths: 24, endOfTerm: 'return' }, usd(6600), 2);
    const b = deviceLine('b', { mode: 'lease', termMonths: 24, endOfTerm: 'return' }, usd(3900));
    const c = deviceLine('c', { mode: 'installments', termMonths: 12, endOfTerm: 'owned-after-final-payment' }, usd(8400));
    expect(summarizeByMode([a, b, c]).map((entry) => [entry.mode, entry.count, entry.dueNow.centAmount, entry.monthly.centAmount])).toEqual([
      ['installments', 1, 8400, 8400],
      ['lease', 3, 10500, 10500],
    ]);
  });
  it('ignores lines that are not devices and answers an empty list for none', () => {
    expect(summarizeByMode([])).toEqual([]);
    expect(summarizeByMode([deviceLine('x', { mode: 'outright', termMonths: 0, endOfTerm: 'owned' }, usd(1), 1, { acquisition: undefined })])).toEqual([]);
  });
});
