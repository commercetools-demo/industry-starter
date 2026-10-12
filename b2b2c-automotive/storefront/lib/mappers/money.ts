// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { TypedMoney } from '@commercetools/platform-sdk';
import type { Money } from '@/lib/types';

/** Keeps `fractionDigits` so high-precision prices format correctly (see `formatMoney`). */
export function mapMoney(m: TypedMoney): Money {
  return { centAmount: m.centAmount, currencyCode: m.currencyCode, fractionDigits: m.fractionDigits };
}
