import { useTranslations } from 'next-intl';

/** Suspense fallback of one product section: four card-shaped blocks, same aspect ratio as the cards (no layout shift). */
export function ProductSectionSkeleton() {
  const t = useTranslations('home');
  return (
    <section aria-busy="true" data-testid="product-section-skeleton" className="home-section">
      <div className="wrap">
        <span className="sr-only" role="status">
          {t('loading')}
        </span>
        <div aria-hidden="true" className="mb-8 h-10 w-64 rounded-field bg-canvas-2" />
        <ul aria-hidden="true" className="grid-products m-0 list-none p-0">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="min-w-0">
              <div className="aspect-[5/6] rounded-card bg-canvas-2" />
              <div className="mt-3 h-4 w-3/4 rounded-field bg-canvas-2" />
              <div className="mt-2 h-4 w-1/3 rounded-field bg-canvas-2" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
