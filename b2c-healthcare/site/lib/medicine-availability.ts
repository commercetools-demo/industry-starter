import { checkShelfLife, isRefusal } from '@/lib/dispense/rules';
import type { MedicineAvailability, Money } from '@/lib/types';

/**
 * Public stock state of a medicine (expiry-dated-supply): no stock, stock that meets the "minimum shelf life on delivery"
 * promise (or is undated), short-dated stock offered on its own terms (actual expiry, own price) and stock that cannot meet
 * the promise and has no short-dated price (not offered). Pure, so every state is a table test. Null when stock is unknown.
 */
export function assessAvailability(input: {
  supply: { available: number; expiryDate?: string } | undefined;
  minRemainingShelfLifeDays: number | null;
  shortDatedPrice: Money | null;
  today: string;
}): MedicineAvailability | null {
  const { supply } = input;
  if (!supply) return null;
  if (supply.available <= 0) return { status: 'out-of-stock' };
  const check = checkShelfLife({ minRemainingShelfLifeDays: input.minRemainingShelfLifeDays, expiryDate: supply.expiryDate, today: input.today });
  if (!isRefusal(check)) return { status: 'in-stock', ...(supply.expiryDate ? { expiryDate: supply.expiryDate } : {}) };
  const daysLeft = check.daysLeft ?? 0;
  if (input.shortDatedPrice && supply.expiryDate && daysLeft > 0) return { status: 'short-dated', expiryDate: supply.expiryDate, shortDatedPrice: input.shortDatedPrice };
  return { status: 'shelf-life', ...(supply.expiryDate ? { expiryDate: supply.expiryDate } : {}) };
}
