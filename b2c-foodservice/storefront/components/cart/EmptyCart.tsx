'use client';

import { useTranslations } from 'next-intl';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';
import { categoryHref } from '@/lib/home-links';

/** Slug of the coffee category (seed key `mcf-cat-coffee`), the page's "Shop coffee" target. */
const COFFEE_SLUG = 'coffee';

/**
 * The empty bag. In the drawer it replaces the list without closing the drawer ("Start shopping" closes it and goes to the
 * shop); on the page it replaces the whole body (no summary block with zero totals).
 */
export default function EmptyCart({ variant, onNavigate }: { variant: 'drawer' | 'page'; onNavigate?: () => void }) {
  const t = useTranslations('cart.empty');
  if (variant === 'drawer') {
    return (
      <div className="flex flex-col items-center gap-4 px-2 py-16 text-center">
        <span className="text-ink-3"><Icon name="bag" size={40} /></span>
        <p className="m-0 font-display text-[17px] font-semibold">{t('title')}</p>
        <ButtonLink href="/shop" data-empty-cta onClick={onNavigate}>
          {t('drawerCta')}
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-24 text-center" data-testid="empty-cart">
      <span className="text-ink-3"><Icon name="bag" size={48} /></span>
      <h1 className="page-title m-0">{t('title')}</h1>
      <p className="m-0 text-[15px] text-ink-3">{t('line')}</p>
      <ButtonLink href={categoryHref(COFFEE_SLUG)} size="lg" data-empty-cta>
        {t('pageCta')}
      </ButtonLink>
    </div>
  );
}
