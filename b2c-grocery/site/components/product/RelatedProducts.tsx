import { useTranslations } from 'next-intl';
import type { Product } from '@/lib/types';
import { ProductTile } from './ProductTile';

export const RELATED_MAX = 4;

/** "Pairs with": up to four products of the same category, never the current one; nothing when there are none. */
export function RelatedProducts({ products, currentId }: { products: Product[]; currentId: string }) {
  const t = useTranslations('pdp');
  const related = products.filter((p) => p.id !== currentId).slice(0, RELATED_MAX);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="pdp-related-title" className="mt-(--space-8)">
      <h2 id="pdp-related-title" className="m-0 mb-(--space-5) text-[28px] tablet:text-[36px]">
        {t('related')}
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-(--space-3) gap-y-(--space-5) p-0 tablet:gap-x-(--space-4) desktop:grid-cols-4">
        {related.map((product) => (
          <li key={product.id}>
            <ProductTile product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
