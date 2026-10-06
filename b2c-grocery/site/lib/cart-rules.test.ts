import { describe, expect, it } from 'vitest';
import { isSlotActive } from './cart-rules';

const slot = (holdExpires?: string) => ({ id: '20261012-10', start: 's', end: 'e', ...(holdExpires ? { holdExpires } : {}) });
const now = new Date('2026-10-12T09:00:00Z');

describe('isSlotActive', () => {
  it('no slot: false', () => expect(isSlotActive(undefined, now)).toBe(false));
  it('hold in the future: true', () => expect(isSlotActive(slot('2026-10-12T09:10:00Z'), now)).toBe(true));
  it('hold expired: false', () => expect(isSlotActive(slot('2026-10-12T09:00:00Z'), now)).toBe(false));
  it('no hold info: true', () => expect(isSlotActive(slot(), now)).toBe(true));
});
