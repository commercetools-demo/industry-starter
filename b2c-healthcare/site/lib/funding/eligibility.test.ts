import { describe, expect, it } from 'vitest';
import { splitBasket } from './eligibility';

const L = (id: string, eligible: boolean, amount: number) => ({ id, eligible, amount });

describe('eligible-item-tender-restriction: basket split (U-08)', () => {
  it('Wholly eligible basket: the eligible subtotal is the whole basket', () => {
    const s = splitBasket([L('a', true, 1875), L('b', true, 1140)]);
    expect(s).toMatchObject({ kind: 'wholly-eligible', eligibleSubtotal: 3015, ineligibleSubtotal: 0 });
  });

  it('Mixed basket splits: each side has its own subtotal', () => {
    const s = splitBasket([L('a', true, 1875), L('b', false, 1260), L('c', true, 620)]);
    expect(s).toMatchObject({ kind: 'mixed', eligibleSubtotal: 2495, ineligibleSubtotal: 1260 });
  });

  it('Wholly ineligible basket: nothing the instrument may pay for', () => {
    const s = splitBasket([L('a', false, 1260), L('b', false, 1310)]);
    expect(s).toMatchObject({ kind: 'none-eligible', eligibleSubtotal: 0, ineligibleSubtotal: 2570 });
  });

  it('an empty basket is none-eligible with zero subtotals', () => {
    expect(splitBasket([])).toMatchObject({ kind: 'none-eligible', eligibleSubtotal: 0, ineligibleSubtotal: 0 });
  });

  it('Basket change re splits: adding an ineligible line moves the split, removing it restores it', () => {
    const before = splitBasket([L('a', true, 1875)]);
    const added = splitBasket([L('a', true, 1875), L('b', false, 1260)]);
    const removed = splitBasket([L('a', true, 1875)]);
    expect(before.kind).toBe('wholly-eligible');
    expect(added).toMatchObject({ kind: 'mixed', eligibleSubtotal: 1875, ineligibleSubtotal: 1260 });
    expect(removed).toEqual(before);
  });

  it('a basket-level discount is apportioned pro rata and the parts add up exactly', () => {
    const s = splitBasket([L('a', true, 1000), L('b', false, 3000)], 400);
    expect(s.perLine.map((l) => l.amount)).toEqual([900, 2700]);
    expect(s.eligibleSubtotal).toBe(900);
    expect(s.ineligibleSubtotal).toBe(2700);
  });

  it('an apportioned discount that does not divide evenly loses nothing to rounding (largest remainder)', () => {
    const lines = [L('a', true, 333), L('b', true, 333), L('c', false, 334)];
    const s = splitBasket(lines, 100);
    expect(s.eligibleSubtotal + s.ineligibleSubtotal).toBe(1000 - 100);
  });

  it('a discount larger than the basket cannot make a line negative', () => {
    const s = splitBasket([L('a', true, 500)], 9999);
    expect(s.perLine[0]!.amount).toBe(0);
  });

  it('shipping is never part of the split: only lines are passed in, so the eligible subtotal excludes delivery', () => {
    // A basket of 3015 with a 500 delivery fee has a payable total of 3515 but an eligible subtotal of 3015.
    const s = splitBasket([L('a', true, 1875), L('b', true, 1140)]);
    expect(s.eligibleSubtotal).toBe(3015);
  });
});
