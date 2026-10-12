// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';

/** "Sold and fulfilled by {reseller}. {days}-day returns at any counter." (days from the store setting `returnWindowDays`, 30 by default). */
export function SellerLine({ reseller, days }: { reseller: string; days: number }) {
  const t = useTranslations('pdp');
  return <p className="m-0 font-ui text-xs text-text-muted">{t('sellerLine', { reseller, days })}</p>;
}
