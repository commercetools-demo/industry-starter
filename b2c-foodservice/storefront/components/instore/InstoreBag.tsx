'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import BigStepper from '@/components/instore/BigStepper';
import InstoreBottomBar from '@/components/instore/InstoreBottomBar';
import { useScanner } from '@/components/instore/scan/scanner-context';
import LineImage from '@/components/cart/LineImage';
import LineNotice from '@/components/cart/LineNotice';
import Button, { buttonClasses } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { ApiError } from '@/hooks/fetcher';
import { useCart } from '@/hooks/useCart';
import { useCartMutations } from '@/hooks/useCartMutations';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import type { Cart, CartLine } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/**
 * The In-store bag (workstream R, D-044), one column: a card per line with a 56 px stepper and Remove, and a bar fixed to the
 * bottom with the total and Checkout. Only what a shopper in a store needs: no discount code box, no fulfilment groups, no
 * free-shipping meter. Every figure is the engine's, read back after each write (workstream I's rule); `initialCart` comes
 * from the server render so the page paints with its lines.
 */
export default function InstoreBag({ initialCart }: { initialCart?: Cart | null }) {
  const t = useTranslations('instore.bag');
  const tc = useTranslations('cart');
  const locale = useLocale();
  const { open } = useScanner();
  const { cart, isLoading, error, mutate } = useCart(initialCart === undefined ? {} : { initialCart });
  const mutations = useCartMutations();
  const [message, setMessage] = useState<string | null>(null);
  const fmt = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);

  const report = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'quantity_exceeds_stock') setMessage(tc('notice.quantityLimit', { n: Number(e.extra.available ?? 0) }));
    else if (e instanceof ApiError && e.code === 'conflict') setMessage(tc('error.conflict'));
    else setMessage(tc('error.generic'));
  };
  const setQuantity = async (line: CartLine, quantity: number) => {
    setMessage(null);
    try {
      await mutations.setQuantity(line.id, quantity);
    } catch (e) {
      report(e);
    }
  };
  const remove = async (line: CartLine) => {
    setMessage(null);
    try {
      await mutations.remove(line.id);
    } catch (e) {
      report(e);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-5">
        <h1 className="m-0 mb-4 font-display text-[28px] font-extrabold tracking-[-0.02em]">{t('title')}</h1>
        <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">
          <div className="h-32 animate-pulse rounded-card bg-canvas-2" />
          <div className="h-32 animate-pulse rounded-card bg-canvas-2" />
        </div>
      </div>
    );
  }
  if (!cart && error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-4 pt-5">
        <h1 className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">{t('title')}</h1>
        <p className="m-0 text-[16px]">{t('loadError')}</p>
        <Button size="lg" variant="ghost" onClick={() => void mutate()} className="min-h-14">
          {t('retry')}
        </Button>
      </div>
    );
  }
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center" data-testid="instore-empty-bag">
        <span className="text-ink-3">
          <Icon name="bag" size={56} />
        </span>
        <h1 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">{t('empty.title')}</h1>
        <p className="m-0 max-w-[32ch] text-[16px] text-ink-2">{t('empty.body')}</p>
        <Button size="lg" variant="accent" className="min-h-14 w-full max-w-[320px]" onClick={open}>
          <Icon name="camera" size={22} />
          {t('empty.scan')}
        </Button>
        <Link href="/" className={cn(buttonClasses({ variant: 'ghost', size: 'lg' }), 'min-h-14 w-full max-w-[320px]')}>
          {t('empty.browse')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-5" data-testid="instore-bag">
      <h1 className="m-0 font-display text-[28px] font-extrabold tracking-[-0.02em]">{t('title')}</h1>
      {message ? (
        <p role="status" data-testid="bag-message" className="m-0 rounded-field bg-canvas-2 px-4 py-3 text-[14.5px] font-medium text-ink">
          {message}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {cart.lines.map((line) => {
          const pending = mutations.isPending(line.id);
          return (
            <li key={line.id} data-testid="bag-line" data-sku={line.sku} className="flex flex-col gap-3 rounded-card border border-line-2 bg-surface p-3">
              <div className="flex gap-3">
                <LineImage {...(line.imageUrl ? { url: line.imageUrl } : {})} alt="" width={80} height={96} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`/p/${encodeURIComponent(line.slug)}/${encodeURIComponent(line.sku)}`} className="font-display text-[17px] font-bold leading-tight text-ink no-underline">
                    {line.name}
                  </Link>
                  {line.variantSummary ? <p className="m-0 text-[14px] text-ink-2">{line.variantSummary}</p> : null}
                  <p className="m-0 mt-1 flex items-baseline gap-2 text-[16px] font-semibold text-ink">
                    <span data-testid="line-total">{fmt(line.total)}</span>
                    {line.quantity > 1 ? <span className="text-[13px] font-normal text-ink-3">{t('each', { price: fmt(line.unitPrice) })}</span> : null}
                  </p>
                  {line.notices.map((n) => (
                    <LineNotice key={n.kind} notice={n} line={line} onShip={() => undefined} pending={pending} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <BigStepper
                  value={line.quantity}
                  min={1}
                  max={line.maxQuantity}
                  pending={pending}
                  onChange={(q) => void setQuantity(line, q)}
                  label={tc('line.qty.label', { name: line.name })}
                />
                <button
                  type="button"
                  onClick={() => void remove(line)}
                  aria-disabled={pending}
                  aria-label={tc('line.removeNamed', { name: line.name })}
                  data-line-remove
                  className="transition-press flex min-h-12 items-center gap-2 rounded-pill border border-line-2 bg-surface px-4 text-[15px] font-semibold text-ink hover:border-ink"
                >
                  <Icon name="trash" size={20} />
                  {tc('line.remove')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <InstoreBottomBar label={t('barLabel')}>
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-medium text-ink-3">{t('total', { count: cart.count })}</span>
            <span className="font-display text-[24px] font-extrabold leading-none text-ink" data-testid="bag-total">
              {fmt(cart.total)}
            </span>
          </div>
          <Link
            href="/checkout"
            aria-disabled={!cart.canCheckout}
            data-testid="bag-checkout"
            className={cn(buttonClasses({ variant: 'accent', size: 'lg' }), 'min-h-14 flex-1 text-[17px]', !cart.canCheckout && 'pointer-events-none opacity-40')}
          >
            {t('checkout')}
            <Icon name="arrowR" size={20} />
          </Link>
        </div>
        <p className="m-0 mt-1.5 text-center text-[12.5px] text-ink-3">{t('note')}</p>
      </InstoreBottomBar>
    </div>
  );
}
