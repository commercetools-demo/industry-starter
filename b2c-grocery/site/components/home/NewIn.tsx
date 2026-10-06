import { useTranslations } from 'next-intl';
import { ProductTile } from '@/components/product/ProductTile';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { Product } from '@/lib/types';

/** "New in": the four newest products, 340 px photos, no heart (the heart belongs to the listing). */
export function NewIn({ products }: { products: Product[] }) {
  const t = useTranslations('home.newIn');
  if (products.length === 0) return null;
  return (
    <section data-section="new-in">
      <SectionHeading kicker={t('kicker')} title={t('title')} linkLabel={t('all')} linkHref="/shop?sort=newest" />
      <ul className="m-0 mt-(--space-6) grid list-none grid-cols-1 gap-x-(--space-4) gap-y-(--space-6) p-0 tablet:grid-cols-2 desktop:grid-cols-4">
        {products.slice(0, 4).map((product) => (
          <li key={product.id}>
            <ProductTile product={product} imageHeight={340} showSave={false} />
          </li>
        ))}
      </ul>
    </section>
  );
}
