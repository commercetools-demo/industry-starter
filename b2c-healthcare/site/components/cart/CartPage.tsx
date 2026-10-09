'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHead } from '@/components/ui/PageHead';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useCartDetails, useCartMutations } from '@/hooks/use-cart';
import { getLocalizedString } from '@/lib/utils';
import type { CartLine } from '@/lib/types';
import { CartLineRow } from './CartLineRow';
import { CartSummaryCard } from './CartSummaryCard';

/**
 * The cart page body (the signed-in check is the (protected) layout's). Server-owned state: the cart is read from
 * `/api/cart` and re-read after every change, never edited locally. An empty cart shows only the lines card with
 * the way back to prescriptions; the summary appears only when there are lines.
 */
export function CartPage() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const toast = useToast();
  const { data: cart, error, isLoading, mutate } = useCartDetails();
  const { removeLine } = useCartMutations();
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);

  async function remove(line: CartLine) {
    setRemoving(line.id);
    setRemoveFailed(false);
    try {
      await removeLine(line.id);
      toast.show({ message: t('removed', { name: getLocalizedString(line.name, locale) }) });
    } catch {
      setRemoveFailed(true);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <PageHead title={t('title')} />
      <div className="mx-auto max-w-content px-5 pb-12 nav:px-8">
        <div className="mt-8 grid items-start gap-6 nav:grid-cols-[1fr_23.75rem]">
          {isLoading && cart === undefined ? (
            <Card aria-busy="true" aria-label={t('loading')} className="grid gap-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
            </Card>
          ) : error && cart === undefined ? (
            <Card className="grid justify-items-start gap-3" role="alert">
              <p className="font-medium text-danger-700">{t('loadFailed')}</p>
              <Button variant="outline" size="sm" onClick={() => void mutate()}>
                {t('retry')}
              </Button>
            </Card>
          ) : cart && cart.lines.length > 0 ? (
            <>
              <Card as="section" aria-label={t('lines')}>
                {removeFailed ? (
                  <p className="mb-3 text-sm font-medium text-danger-700" role="alert">
                    {t('removeFailed')}
                  </p>
                ) : null}
                <ul>
                  {cart.lines.map((line) => (
                    <CartLineRow key={line.id} line={line} busy={removing === line.id} onRemove={remove} />
                  ))}
                </ul>
              </Card>
              <CartSummaryCard cart={cart} />
            </>
          ) : (
            <Card className="grid justify-items-start gap-4" data-cart-empty>
              <p className="text-neutral-600">{t('empty')}</p>
              <ButtonLink href="/prescriptions">{t('findPrescription')}</ButtonLink>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
