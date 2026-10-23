import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import StockLine from '@/components/instore/StockLine';
import { Link } from '@/i18n/routing';
import { transformThumbnailImageUrl } from '@/lib/ct/image-config';
import type { InstoreRow } from '@/lib/instore/category';
import { formatMoney } from '@/lib/utils';

/**
 * One product in a category list (workstream R): image, name, price and availability, nothing else. The whole row is the link
 * (at least 96 px tall). "From" is shown when the product has several prices (pack sizes, sizes), as on the website's card.
 */
export default function ProductRow({ row }: { row: InstoreRow }) {
  const t = useTranslations('instore.category');
  const locale = useLocale();
  const price = row.price;
  const money = price ? formatMoney(price.from.centAmount, price.from.currencyCode, locale) : null;
  return (
    <Link
      href={`/p/${encodeURIComponent(row.slug)}/${encodeURIComponent(row.sku)}`}
      data-testid="instore-row"
      className="transition-press flex min-h-24 items-center gap-4 rounded-card border border-line-2 bg-surface p-3 text-ink no-underline hover:border-ink active:scale-[0.99]"
    >
      <span className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-field bg-canvas-2">
        {row.imageUrl ? <Image src={transformThumbnailImageUrl(row.imageUrl)} alt="" fill sizes="84px" className="object-cover" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-[17px] font-bold leading-tight">{row.name}</span>
        <span className="text-[16px] font-semibold" data-testid="row-price">
          {money ? (price?.fromIsRange ? t('priceFrom', { price: money }) : money) : <span className="text-[14px] font-medium text-ink-2">{t('noPrice')}</span>}
        </span>
        <StockLine state={row.availability} />
      </span>
    </Link>
  );
}
