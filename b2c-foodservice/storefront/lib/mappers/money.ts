import type { Money as SDKMoney, TypedMoney } from '@commercetools/platform-sdk';
import type { Money } from '@/lib/types';

/** Integer minor units only; fractionDigits and type are ignored. */
export function mapMoney(m: TypedMoney | SDKMoney | Money): Money {
  return { centAmount: m.centAmount, currencyCode: m.currencyCode };
}
