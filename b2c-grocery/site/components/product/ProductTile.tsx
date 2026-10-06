import { useTranslations } from 'next-intl';
import { Photo } from '@/components/ui/Photo';
import { Tag } from '@/components/ui/Tag';
import { Link } from '@/i18n/routing';
import type { Product } from '@/lib/types';
import { PriceBlock } from './PriceBlock';
import { SaveButton } from './SaveButton';

/** Listing tile: washed 330 px photo, heart top-right, "Out of stock" top-left, name and price on one baseline row, brand. */
export function ProductTile({
  product,
  priority,
  imageHeight = 330,
  showSave = true,
}: {
  product: Product;
  priority?: boolean;
  /** Photo height in px: 330 on the listing, 340 on the homepage. */
  imageHeight?: 330 | 340;
  /** The heart is only drawn on the listing, not on homepage tiles. */
  showSave?: boolean;
}) {
  const t = useTranslations('plp');
  const variant = product.variants[0];
  const outOfStock = variant ? !variant.availability.isOnStock : false;
  return (
    <article className="lift relative" data-product-id={product.id}>
      <Link href={`/p/${product.slug}`} className="block text-text no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent rounded-lg">
        <Photo src={variant?.images[0] ?? ''} alt={product.name} sizes="(min-width: 75rem) 330px, 50vw" priority={priority} className={imageHeight === 340 ? 'h-[340px]' : 'h-[330px]'} />
        <div className="mt-(--space-3) flex items-baseline justify-between gap-(--space-3)">
          <h3 className="card-title m-0">{product.name}</h3>
          <PriceBlock price={variant?.price} className="flex-none text-[15px]" />
        </div>
        {product.brand ? <div className="card-meta mt-(--space-1)">{product.brand}</div> : null}
      </Link>
      {outOfStock ? <Tag tone="accent" className="absolute top-3 left-3">{t('outOfStock')}</Tag> : null}
      {showSave ? <SaveButton productId={product.id} name={product.name} className="absolute top-3 right-3" /> : null}
    </article>
  );
}
