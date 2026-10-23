import { useLocale, useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { ProductSummary } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/** Glass card on the hero image: the featured product's name and price, one link to its page. Omitted without a price. */
export default function HeroFeaturedCard({ product }: { product: ProductSummary }) {
  const t = useTranslations('home.hero');
  const locale = useLocale();
  if (!product.price) return null;
  const { from } = product.price;
  const price = formatMoney(from.centAmount, from.currencyCode, locale);
  return (
    <Link
      href={`/p/${encodeURIComponent(product.slug)}/${encodeURIComponent(product.sku)}`}
      data-testid="hero-featured-card"
      className="home-glass absolute inset-x-5 bottom-5 flex items-center justify-between gap-4 rounded-card p-4 text-ink no-underline"
    >
      <span className="min-w-0">
        <span className="eyebrow block">{t('favourite')}</span>
        <span className="mt-1 block truncate font-display text-[15px] font-semibold">{product.name}</span>
      </span>
      <span className={buttonClasses({ variant: 'ink' })}>{price}</span>
    </Link>
  );
}
