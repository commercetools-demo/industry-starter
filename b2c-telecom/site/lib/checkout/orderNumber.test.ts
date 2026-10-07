import { generateOrderNumber, isOrderNumber } from './orderNumber';

describe('order number', () => {
  it('1000 generated numbers all match the pattern and are distinct', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const n = generateOrderNumber();
      expect(isOrderNumber(n)).toBe(true);
      seen.add(n);
    }
    expect(seen.size).toBe(1000);
  });
  it('rejects lookalikes and the reserved word', () => {
    expect(isOrderNumber('return')).toBe(false);
    expect(isOrderNumber('MLV-AAAAAAAA')).toBe(true);
    expect(isOrderNumber('mlv-aaaaaaaa')).toBe(false);
  });
});
