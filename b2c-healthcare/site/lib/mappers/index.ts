import type { TypedMoney } from '@commercetools/platform-sdk';
import type { LocalizedString, Money } from '@/lib/types';

/** SDK -> app mappers. Skeleton: later workstreams add one file per resource and re-export here. */

export function mapMoney(money: Pick<TypedMoney, 'centAmount' | 'currencyCode' | 'fractionDigits'>): Money {
  return {
    centAmount: money.centAmount,
    currencyCode: money.currencyCode,
    fractionDigits: money.fractionDigits,
  };
}

/** Copies a localized string; the locale lookup itself happens at render time, never here with a hard-coded key. */
export function mapLocalizedString(value: Record<string, string> | undefined): LocalizedString {
  return { ...value };
}
