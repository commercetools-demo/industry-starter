import { getTranslations } from 'next-intl/server';
import ProductGrid from '@/components/listing/ProductGrid';
import { getCompatibleCapsules, getRelatedContext, getRelatedProducts } from '@/lib/related';
import type { ProductDetail, ProductSummary } from '@/lib/types';

const quiet = (event: string) => (e: unknown): ProductSummary[] => {
  console.error(JSON.stringify({ event, status: (e as { statusCode?: number })?.statusCode }));
  return [];
};

/**
 * "Goes well with" (machines that take capsules: compatible pods first) and "You may also like" (workstream H, 3.9).
 * A server component, streamed after the page. A failed read omits that strip; it never breaks the product page. Each
 * strip is omitted when it has no cards.
 */
export default async function RelatedStrip({ product, locale }: { product: ProductDetail; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'pdp.related' });
  const ctx = await getRelatedContext(locale).catch(() => null);
  if (!ctx) return null;
  const [goesWith, related] = await Promise.all([
    getCompatibleCapsules(product, ctx).catch(quiet('pdp_goes_with_failed')),
    getRelatedProducts(product, ctx).catch(quiet('pdp_related_failed')),
  ]);
  return (
    <>
      {goesWith.length > 0 ? (
        <section aria-labelledby="pdp-goes-with" className="border-t border-line py-8" data-testid="goes-with">
          <h2 id="pdp-goes-with" className="m-0 mb-5 font-display text-[22px] font-bold text-ink">{t('goesWith')}</h2>
          <ProductGrid products={goesWith} wide />
        </section>
      ) : null}
      {related.length > 0 ? (
        <section aria-labelledby="pdp-related" className="border-t border-line py-8" data-testid="related">
          <h2 id="pdp-related" className="m-0 mb-5 font-display text-[22px] font-bold text-ink">{t('title')}</h2>
          <ProductGrid products={related} wide />
        </section>
      ) : null}
    </>
  );
}
