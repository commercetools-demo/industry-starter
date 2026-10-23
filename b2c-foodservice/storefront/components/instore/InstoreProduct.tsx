'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { SWRConfig, unstable_serialize } from 'swr';
import BigStepper from '@/components/instore/BigStepper';
import InstoreBottomBar from '@/components/instore/InstoreBottomBar';
import StockLine from '@/components/instore/StockLine';
import OptionGroup from '@/components/pdp/OptionGroup';
import { PdpProvider, usePdp } from '@/components/pdp/pdp-state';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/context/toast';
import { useAddToCart } from '@/hooks/useAddToCart';
import { Link } from '@/i18n/routing';
import { availabilityState } from '@/lib/availability';
import { keyChannels } from '@/lib/cache-keys';
import { transformListingImageUrl } from '@/lib/ct/image-config';
import { addButtonState } from '@/lib/product/add-state';
import { effectiveUnitPrice, lineTotal } from '@/lib/product/price';
import type { Selection } from '@/lib/product/resolve-variant';
import { LOW_STOCK_THRESHOLD } from '@/lib/shop-config';
import type { Money, ProductPageData } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * The In-store product page (workstream R, D-044): the image, the name, the price, whether it is in stock, the choices (size,
 * grind, pack, colour) and a bottom bar with the quantity and Add to bag. No tagline, facts, reviews, related products, trust
 * row or accordions, and no fulfilment choice: every line is delivery (D-044).
 *
 * It reuses H's state (`PdpProvider`: variant resolution, stock limits, the URL mirror) with collection switched off, and tells
 * SWR that the store list is "known and empty" so the provider reads nothing from `/api/channels`.
 */
export default function InstoreProduct({ data, initialSelection }: { data: ProductPageData; initialSelection: Selection }) {
  const noStores = { [unstable_serialize(keyChannels(data.country))]: { stores: [], selectedKey: null } };
  return (
    <SWRConfig value={{ fallback: noStores, revalidateOnMount: false, revalidateIfStale: false, revalidateOnFocus: false }}>
      <PdpProvider data={{ ...data, collection: false }} initialSelection={initialSelection}>
        <Body />
      </PdpProvider>
    </SWRConfig>
  );
}

function Body() {
  const t = useTranslations('instore.product');
  const tp = useTranslations('pdp');
  const tShell = useTranslations('shell.toast');
  const locale = useLocale();
  const toast = useToast();
  const { data, variant, preview, quantity, setQuantity, minQty, maxQty, missing } = usePdp();
  const { add, isAdding, error } = useAddToCart();
  const { product } = data;
  const fmt = (m: Money) => formatMoney(m.centAmount, m.currencyCode, locale);

  const crumb = product.breadcrumb[product.breadcrumb.length - 1];
  const image = preview.images[0] ?? product.variants.find((v) => v.images[0])?.images[0];

  const choice = missing && tp.has(`selector.choice.${missing.attr}`) ? tp(`selector.choice.${missing.attr}`) : (missing?.attr ?? '');
  const state = addButtonState({
    ...(missing ? { missingChoice: choice } : {}),
    variant,
    fulfilment: 'delivery',
    quantity,
    inventoryFailed: data.inventoryFailed,
  });

  let headline: string;
  if (variant?.price) {
    headline = fmt(effectiveUnitPrice(variant.price, quantity));
  } else if (variant) {
    headline = tp('priceOnRequest');
  } else {
    const amounts = product.variants.flatMap((v) => (v.price ? [(v.price.discounted ?? v.price.value).centAmount] : []));
    const currency = product.variants.find((v) => v.price)?.price?.value.currencyCode;
    if (amounts.length === 0 || !currency) headline = tp('priceOnRequest');
    else {
      const low = fmt({ centAmount: Math.min(...amounts), currencyCode: currency });
      headline = Math.min(...amounts) === Math.max(...amounts) ? low : tp('priceFrom', { amount: low });
    }
  }
  const old = variant?.price?.discounted ? variant.price.value : undefined;

  const stockState = variant ? (data.inventoryFailed ? null : availabilityState(variant.stock.online, LOW_STOCK_THRESHOLD)) : undefined;
  const total = state.showTotal && variant?.price ? lineTotal(variant.price, quantity) : null;
  const base = tp(`add.${state.key}`, { choice });
  const label = total ? tp('add.withTotal', { label: base, total: fmt(total) }) : base;

  const onAdd = async () => {
    if (!variant || state.disabled || isAdding) return;
    const cart = await add({ sku: variant.sku, quantity, fulfilment: 'delivery' });
    if (cart) toast.show(tShell('added'));
  };

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-3" data-testid="instore-product">
      <Link
        href={crumb ? `/c/${encodeURIComponent(crumb.slug)}` : '/'}
        className="inline-flex min-h-12 w-fit items-center gap-2 pr-3 text-[15px] font-semibold text-ink-2 no-underline"
      >
        <Icon name="chevL" size={22} />
        {crumb ? t('backTo', { name: crumb.name }) : t('home')}
      </Link>

      <div className="relative h-[190px] w-full overflow-hidden rounded-card bg-canvas-2">
        {image ? <Image src={transformListingImageUrl(image.url)} alt={image.alt ?? product.name} fill priority sizes="100vw" className="object-cover" /> : null}
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{product.name}</h1>
        <p className="m-0 flex items-baseline gap-2.5 text-[26px] font-semibold text-ink" data-testid="pdp-price">
          <span>{headline}</span>
          {old ? <s className="text-[16px] font-normal text-ink-3">{fmt(old)}</s> : null}
        </p>
        {stockState !== undefined ? <StockLine state={stockState} /> : null}
      </header>

      {product.selectors.map((s) => (
        <OptionGroup key={s.attr} selector={s} large />
      ))}

      {error ? (
        <p role="alert" className="m-0 text-[14.5px] font-medium text-danger-text">
          {tp('error.generic')}
        </p>
      ) : null}

      <InstoreBottomBar label={t('barLabel')}>
        <div className="flex items-center gap-3">
          <BigStepper value={quantity} min={minQty} max={maxQty} onChange={setQuantity} label={tp('qty.label')} />
          <Button
            size="lg"
            variant="accent"
            loading={isAdding}
            disabled={state.disabled}
            onClick={() => void onAdd()}
            data-testid="add-to-bag"
            data-state={state.key}
            className="min-h-14 min-w-0 flex-1 px-3 text-[16px] leading-tight whitespace-normal!"
          >
            {label}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {label}
        </p>
      </InstoreBottomBar>
    </div>
  );
}
