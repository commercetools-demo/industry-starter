'use client';

import { useTranslations } from 'next-intl';
import AvailabilityLine from '@/components/product/AvailabilityLine';
import CardImage from '@/components/product/CardImage';
import PriceLine from '@/components/product/PriceLine';
import QuickAdd from '@/components/product/QuickAdd';
import SaveButton from '@/components/product/SaveButton';
import Swatches from '@/components/product/Swatches';
import Badge from '@/components/ui/Badge';
import Rating from '@/components/ui/Rating';
import { Link } from '@/i18n/routing';
import type { CardBadge, ProductSummary } from '@/lib/types';

const BADGE_KEY: Record<CardBadge, 'bestseller' | 'new' | 'limitedEdition' | 'subscribe'> = {
  bestseller: 'bestseller', new: 'new', 'limited-edition': 'limitedEdition', subscribe: 'subscribe',
};

/**
 * Product card for every grid (listing, search, home, related, saved). Exported for H, L, M and O.
 * One click target: the name link is stretched over the card with ::after; the heart, Quick add and "Choose a store" are
 * siblings above it (z-20), so no interactive element sits inside an anchor. `data-price` is the amount to pay in minor units.
 */
export default function ProductCard({ product, imagePriority = false }: { product: ProductSummary; imagePriority?: boolean }) {
  const t = useTranslations('card');
  const tPlp = useTranslations('plp');
  const href = `/p/${encodeURIComponent(product.slug)}/${encodeURIComponent(product.sku)}`;
  return (
    <article
      data-testid="product-card"
      data-sku={product.sku}
      data-price={product.price?.from.centAmount ?? ''}
      className="group relative flex min-w-0 flex-col"
    >
      <div className="transition-state relative aspect-[5/6] overflow-hidden rounded-card bg-canvas-2 group-hover:shadow-card-hover group-focus-within:shadow-card-hover motion-reduce:transition-none">
        <CardImage url={product.imageUrl} alt={product.imageAlt} placeholder={tPlp('noPhoto')} priority={imagePriority} />
        {product.badge ? (
          <Badge
            variant={product.badge === 'new' || product.badge === 'limited-edition' ? 'accent' : 'ink'}
            className="absolute left-3 top-3 z-20"
          >
            {t(`badge.${BADGE_KEY[product.badge]}`)}
          </Badge>
        ) : null}
        <SaveButton productId={product.id} name={product.name} />
        <QuickAdd product={product} />
      </div>
      <div className="flex flex-1 flex-col gap-1 pt-3">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{product.categoryName}</p>
        <h3 className="m-0 font-display text-[15.5px] font-semibold leading-snug text-ink">
          <Link
            href={href}
            className="line-clamp-2 no-underline after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {product.name}
          </Link>
        </h3>
        {product.rating ? <Rating value={product.rating.average} count={product.rating.count} small /> : null}
        {product.matchedSku ? <p className="m-0 font-mono text-[11px] text-ink-3">{t('matchedVariant', { sku: product.matchedSku })}</p> : null}
        <div className="flex items-start justify-between gap-2">
          <PriceLine price={product.price} unit={product.unit} />
          <div className="flex shrink-0 flex-col items-end gap-1">
            {product.swatches ? <Swatches swatches={product.swatches} /> : null}
            {product.label ? (
              <span className="rounded-pill bg-canvas-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
                {product.label.kind === 'intensity' ? t('intensity', { n: product.label.value }) : product.label.value}
              </span>
            ) : null}
          </div>
        </div>
        <AvailabilityLine state={product.availability?.state ?? null} />
      </div>
    </article>
  );
}
