'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import BigStepper from '@/components/instore/BigStepper';
import StockLine from '@/components/instore/StockLine';
import Button, { buttonClasses } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { Link } from '@/i18n/routing';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useCart } from '@/hooks/useCart';
import { transformThumbnailImageUrl } from '@/lib/ct/image-config';
import type { ScanProduct } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * The product a scan led to (workstream R): image, name, variant attributes, price, availability, a quantity stepper and Add to
 * bag. Out of stock, a missing price and a failed stock read disable the button and say why. A unit already in the bag is
 * counted against the stock so a shopper cannot add more than exists (the bag would refuse it later). After an add the sheet
 * offers "Scan another" and "View bag"; nothing navigates by itself.
 */
export default function ScanResult({
  product, onScanAnother, onClose,
}: {
  product: ScanProduct;
  onScanAnother: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('instore.scan.result');
  const locale = useLocale();
  const { cart } = useCart();
  const { add, isAdding, error } = useAddToCart();
  const [added, setAdded] = useState<number | null>(null);

  const inBag = cart?.lines.filter((l) => l.sku === product.sku).reduce((n, l) => n + l.quantity, 0) ?? 0;
  const room = Math.max(0, product.maxQuantity - inBag);
  const min = Math.min(product.minQuantity, Math.max(room, 1));
  const [quantity, setQuantity] = useState(min);
  const shown = Math.min(Math.max(quantity, min), Math.max(room, min));

  const fmt = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  const out = product.availability.state === 'out' || product.inventoryFailed;
  const blocked: 'noPrice' | 'outOfStock' | 'stockUnknown' | 'allInBag' | null = !product.price
    ? 'noPrice'
    : product.inventoryFailed
      ? 'stockUnknown'
      : out
        ? 'outOfStock'
        : room < product.minQuantity
          ? 'allInBag'
          : null;
  const total = product.price ? { centAmount: product.price.amount.centAmount * shown, currencyCode: product.price.amount.currencyCode } : null;

  const onAdd = async () => {
    if (blocked || isAdding) return;
    const result = await add({ sku: product.sku, quantity: shown, fulfilment: 'delivery' });
    if (result) setAdded(shown);
  };

  return (
    <div data-testid="scan-result" data-sku={product.sku} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-field bg-canvas-2">
          {product.imageUrl ? (
            <Image src={transformThumbnailImageUrl(product.imageUrl)} alt="" fill sizes="96px" className="object-cover" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="m-0 font-display text-[20px] font-bold leading-tight text-ink">{product.name}</h3>
          {product.variant ? <p className="m-0 text-[14.5px] text-ink-2">{product.variant}</p> : null}
          <p className="m-0 flex items-baseline gap-2 text-[22px] font-semibold text-ink" data-testid="scan-price">
            {product.price ? (
              <>
                <span>{fmt(product.price.amount)}</span>
                {product.price.old ? <s className="text-[15px] font-normal text-ink-3">{fmt(product.price.old)}</s> : null}
              </>
            ) : (
              <span className="text-[16px] font-medium text-ink-2">{t('noPrice')}</span>
            )}
          </p>
          <StockLine state={product.inventoryFailed ? null : product.availability.state} />
        </div>
      </div>

      {inBag > 0 && added === null ? (
        <p role="status" className="m-0 text-[14px] font-medium text-ink-2" data-testid="scan-in-bag">
          {t('inBag', { count: inBag })}
        </p>
      ) : null}

      {added !== null ? (
        <div className="flex flex-col gap-3" data-testid="scan-added">
          <p role="status" className="m-0 flex items-center gap-2 text-[16px] font-semibold text-teal-text">
            {t('added', { count: added })}
          </p>
          <div className="flex gap-3">
            <Button size="lg" variant="accent" className="min-h-14 flex-1" onClick={onScanAnother}>
              {t('scanAnother')}
            </Button>
            <Link href="/bag" onClick={onClose} className={cn(buttonClasses({ variant: 'ghost', size: 'lg' }), 'min-h-14 flex-1 border-line-2!')}>
              {t('viewBag')}
            </Link>
          </div>
        </div>
      ) : blocked ? (
        <div className="flex flex-col gap-3">
          <p role="status" data-testid="scan-blocked" data-reason={blocked} className="m-0 rounded-field bg-canvas-2 px-4 py-3 text-[14.5px] font-medium text-ink">
            {t(blocked)}
          </p>
          <Button size="lg" variant="ink" className="min-h-14" onClick={onScanAnother}>
            {t('scanAnother')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <BigStepper value={shown} min={min} max={Math.max(room, min)} onChange={setQuantity} label={t('quantity')} />
            <Button size="lg" variant="accent" loading={isAdding} onClick={() => void onAdd()} data-testid="scan-add" className="min-h-14 min-w-0 flex-1 px-3 leading-tight whitespace-normal!">
              {total ? t('addWithTotal', { total: fmt(total) }) : t('add')}
            </Button>
          </div>
          {shown >= Math.max(room, min) && product.maxQuantity < 99 ? (
            <p className="m-0 text-[13.5px] text-ink-3">{t('limit', { n: product.maxQuantity })}</p>
          ) : null}
          {error ? (
            <p role="alert" className="m-0 text-[14px] font-medium text-danger-text">
              {t('error')}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {added === null && !blocked ? (
          <button type="button" onClick={onScanAnother} className="min-h-12 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink underline underline-offset-4">
            {t('scanAnother')}
          </button>
        ) : null}
        <Link href={product.href} onClick={onClose} className="inline-flex min-h-12 items-center text-[15px] font-medium text-ink-2 underline underline-offset-4">
          {t('moreChoices')}
        </Link>
      </div>
    </div>
  );
}
