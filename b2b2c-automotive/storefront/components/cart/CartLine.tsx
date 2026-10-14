// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { LineFitBadge } from '@/components/cart/FitWarning';
import { QuantityStepper } from '@/components/cart/QuantityStepper';
import { Badge } from '@/components/ui/Badge';
import { Link } from '@/i18n/routing';
import type { CartFit, CartLine as CartLineModel } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

interface Props {
  line: CartLineModel;
  /** Store key of the address, for the link to the product page. */
  store: string;
  /** Fit against the active vehicle, computed live by the page (the line carries the server's reading at load time). */
  fit?: CartFit;
  /** Label of the active vehicle for the fit badge. */
  vehicleLabel?: string | null;
  /** The shopper reported a branch with no price for this part. */
  unpriced?: boolean;
  /** The locked component lines of a bundle line (W-11), listed under it; they have no stepper, no remove and no price. */
  components?: CartLineModel[];
  onQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  alternativesHref: string;
}

function StockLine({ line }: { line: CartLineModel }) {
  const t = useTranslations('cart');
  const { stock } = line;
  if (stock.available === 0) return <span className="text-danger-600">{t('stockOut')}</span>;
  if (stock.capped) return <span className="text-accent-700">{t('stockOnly', { count: stock.available })}</span>;
  if (stock.shipsLater > 0 && stock.fromStore > 0 && stock.branchName) {
    return <span className="text-accent-700">{t('stockSplit', { fromStore: stock.fromStore, branch: stock.branchName, shipsLater: stock.shipsLater })}</span>;
  }
  if (stock.shipsLater > 0) return <span className="text-accent-700">{t('stockShipsLater')}</span>;
  return <span className="text-success-600">{stock.branchName ? t('stockInStock', { branch: stock.branchName }) : t('stockInStockNoBranch')}</span>;
}

/** One cart line (workstream N, design view `cart`): image, brand, name, stock line, quantity stepper, Remove and the line total. */
export function CartLine({ line, store, fit = line.fit, vehicleLabel = null, unpriced = false, components = [], onQuantity, onRemove, alternativesHref }: Props) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string; fractionDigits: number }) => formatMoney(m.centAmount, m.currencyCode, locale, m.fractionDigits);
  const href = `/${store}/p/${line.productSlug}`;

  return (
    <li className="grid grid-cols-[6rem_1fr_auto] items-center gap-4 rounded-md border border-border bg-surface p-3">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-square overflow-hidden rounded-md bg-surface-subtle">
        {line.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="6rem" className="object-contain" /> : null}
      </Link>
      <div className="grid min-w-0 gap-1">
        {line.brand ? <span className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{line.brand}</span> : null}
        <Link href={href} className="min-h-6 font-display text-sm font-medium text-text hover:text-text-link">
          {line.name}
        </Link>
        {line.recurrence ? (
          <Badge tone="info" className="w-fit">
            {t('subscription', { frequency: line.recurrence.policyName })}
          </Badge>
        ) : null}
        <span className="font-ui text-xs">
          <StockLine line={line} />
        </span>
        {components.length > 0 ? (
          <ul aria-label={t('bundleIncludes')} className="m-0 grid list-none gap-1 p-0 font-ui text-xs text-text-muted">
            {components.map((component) => (
              <li key={component.id}>
                {t('bundleComponent', { count: component.quantity, name: component.name })}
                {component.stock.available === 0 ? <span className="text-danger-600"> · {t('stockOut')}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {fit === 'does-not-fit' && vehicleLabel ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <LineFitBadge vehicle={vehicleLabel} />
            <Link href={alternativesHref} className="inline-flex min-h-6 items-center font-utility text-xs text-text-link underline underline-offset-2">
              {t('fit.alternatives')}
            </Link>
          </span>
        ) : null}
        {unpriced ? (
          <span role="alert" className="font-ui text-xs text-danger-600">
            {t('unpriced')}
          </span>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <QuantityStepper value={line.quantity} name={line.name} onChange={(next) => onQuantity(line.id, next)} />
          <button type="button" onClick={() => onRemove(line.id)} aria-label={t('removeLabel', { name: line.name })} className="min-h-7 font-utility text-sm text-text-link underline-offset-2 hover:underline">
            {t('remove')}
          </button>
        </div>
      </div>
      <div className="grid justify-items-end gap-1 self-start">
        <span className="font-display text-lg font-semibold text-text-price">{money(line.total)}</span>
        {line.listUnitPrice ? (
          <>
            <s className="font-display text-sm text-text-price-old">{money({ ...line.listUnitPrice, centAmount: line.listUnitPrice.centAmount * line.quantity })}</s>
            <span className="sr-only">{t('wasPrice', { price: money({ ...line.listUnitPrice, centAmount: line.listUnitPrice.centAmount * line.quantity }) })}</span>
          </>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {t('announce', { name: line.name, count: line.quantity, total: money(line.total) })}
      </p>
    </li>
  );
}
