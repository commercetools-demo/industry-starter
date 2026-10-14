/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The only price rule (owner Q-T03: no MAP floor): a price is valid when it is a cent precision amount of the store currency,
// a whole number of cents above zero with two fraction digits. Anything else is INVALID_MONEY.
import { CatalogError } from '@/lib/catalog/errors';

export const INVALID_MONEY_MESSAGE = 'Enter a price above zero with at most two decimals';

export class RuleViolation extends CatalogError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(400, code, message, details);
    this.name = 'RuleViolation';
  }
}

export interface PriceInput {
  type?: unknown;
  currencyCode?: unknown;
  centAmount?: unknown;
  fractionDigits?: unknown;
}

export function isValidPrice(price: PriceInput, currency: string): boolean {
  return (
    price.type === 'centPrecision' &&
    price.currencyCode === currency &&
    typeof price.centAmount === 'number' &&
    Number.isInteger(price.centAmount) &&
    price.centAmount > 0 &&
    Number.isSafeInteger(price.centAmount) &&
    price.fractionDigits === 2
  );
}

/** Throws `RuleViolation({ code: 'INVALID_MONEY' })` unless the price is valid for the store currency. */
export function assertValidPrice({ price, currency }: { price: PriceInput; currency: string }): void {
  if (!isValidPrice(price, currency)) throw new RuleViolation('INVALID_MONEY', INVALID_MONEY_MESSAGE);
}

/** The commercetools money value of a valid whole-cent amount in the currency. */
export function centMoney(centAmount: number, currency: string) {
  return { type: 'centPrecision' as const, currencyCode: currency, centAmount, fractionDigits: 2 };
}
