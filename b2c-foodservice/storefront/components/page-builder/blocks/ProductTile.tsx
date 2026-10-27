import { useTranslations } from 'next-intl';
import type { ProductCard } from '@commercetools-labs/page-builder';
import CardImage from '@/components/product/CardImage';
import PriceLine from '@/components/product/PriceLine';
import { Link } from '@/i18n/routing';
import { authoredImage, productHref, tilePrice } from '@/lib/page-builder/authored';

/**
 * A product tile built from the service's product card. It is a plain link to the product page with image, name and price:
 * the service card does not say whether a product needs a choice (grind, colour) or whether it is available to collect, so
 * the native card's quick add and availability line are left out rather than guessed.
 */
export default function ProductTile({ product, showPrice = true, imagePriority = false }: { product: ProductCard; showPrice?: boolean; imagePriority?: boolean }) {
  const t = useTranslations('plp');
  const image = authoredImage(product.image?.url);
  return (
    <article data-testid="pb-product-tile" data-sku={product.sku} className="group relative flex min-w-0 flex-col">
      <div className="transition-state relative aspect-[5/6] overflow-hidden rounded-card bg-canvas-2 group-hover:shadow-card-hover group-focus-within:shadow-card-hover motion-reduce:transition-none">
        <CardImage url={image} alt={product.image?.alt ?? product.name} placeholder={t('noPhoto')} priority={imagePriority} />
      </div>
      <div className="flex flex-1 flex-col gap-1 pt-3">
        <h3 className="m-0 font-display text-[15.5px] font-semibold leading-snug text-ink">
          <Link
            href={productHref(product)}
            className="line-clamp-2 no-underline after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {product.name}
          </Link>
        </h3>
        {showPrice ? <PriceLine price={tilePrice(product.price)} /> : null}
      </div>
    </article>
  );
}
