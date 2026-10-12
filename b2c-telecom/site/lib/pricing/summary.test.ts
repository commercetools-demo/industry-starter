import { makeCart, phoneLine, planLine, addonLine, feeLine, usd } from '@/test/fixtures/cart';
import { rowsSum, summaryRows, taxAddedOf, thenMonthlyOf } from './summary';

describe('thenMonthlyOf', () => {
  it('sums the standing (list) price times quantity of recurring lines and ignores one-time lines and fees', () => {
    const lines = [planLine({ unitListPrice: usd(5999), unitPrice: usd(0), total: usd(0) }), phoneLine({ quantity: 2, unitListPrice: usd(5500) }), feeLine()];
    expect(thenMonthlyOf(lines, 'USD').centAmount).toBe(5999 + 11000);
  });
  it('is zero without recurring lines', () => expect(thenMonthlyOf([feeLine()], 'USD').centAmount).toBe(0));
});

describe('taxAddedOf', () => {
  it('null when there is no taxed price or the tax is part of the price', () => {
    expect(taxAddedOf(usd(1000), null)).toBeNull();
    expect(taxAddedOf(usd(1000), usd(1000))).toBeNull();
  });
  it('the difference when tax is added on top', () => expect(taxAddedOf(usd(1000), usd(1190))).toEqual(usd(190)));
});

describe('summaryRows', () => {
  it('drops zero rows and shows the order discount as negative', () => {
    const cart = makeCart({ lines: [planLine(), addonLine()], summary: { orderDiscount: usd(500) } });
    expect(summaryRows(cart.summary).map((row) => row.id)).toEqual(['plans', 'addons', 'orderDiscount']);
    expect(summaryRows(cart.summary).find((row) => row.id === 'orderDiscount')?.amount.centAmount).toBe(-500);
  });

  it('the rows foot to Due today (plans, add-ons, fees, order discount, shipping and added tax)', () => {
    const cart = makeCart({
      lines: [planLine(), addonLine(), feeLine()],
      summary: { orderDiscount: usd(1000), shipping: usd(500), taxAdded: usd(300), dueToday: usd(5999 + 999 + 2500 - 1000 + 500 + 300) },
    });
    expect(rowsSum(cart.summary)).toEqual(cart.summary.dueToday);
  });

  it('"You save" and "Then monthly" are not rows', () => {
    const ids = summaryRows(makeCart({ summary: { discountTotal: usd(900) } }).summary).map((row) => row.id as string);
    expect(ids).not.toContain('save');
    expect(ids).not.toContain('thenMonthly');
  });
});
