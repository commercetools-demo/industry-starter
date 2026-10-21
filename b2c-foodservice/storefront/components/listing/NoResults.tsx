import { useTranslations } from 'next-intl';
import ProductGrid from '@/components/listing/ProductGrid';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import type { ProductSummary } from '@/lib/types';

/**
 * A query matched nothing. Says so with the query as text, notes that typo-tolerant matching was already applied (no
 * "did you mean" is claimed, Q-G-08), and offers a way back: the root categories and, when there are any, four
 * bestsellers (Q-G-11). The search input stays above, editable and focused.
 */
export default function NoResults({
  query, categories, bestsellers,
}: {
  query: string;
  categories: { name: string; href: string }[];
  bestsellers: ProductSummary[];
}) {
  const t = useTranslations('plp.noResults');
  return (
    <div className="py-12" data-testid="no-results">
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon name="search" size={40} className="text-ink-3" />
        <p className="m-0 font-display text-[20px] font-semibold text-ink">{t('title', { query })}</p>
        <p className="m-0 max-w-[480px] text-[14px] text-ink-3">{t('hint')}</p>
      </div>
      {categories.length > 0 ? (
        <section className="mt-10" aria-labelledby="no-results-browse">
          <h2 id="no-results-browse" className="m-0 mb-3 font-display text-[16px] font-semibold text-ink">{t('browse')}</h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {categories.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="inline-block rounded-pill border border-line-2 bg-surface px-4 py-2 text-[13px] font-medium text-ink no-underline hover:border-ink">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {bestsellers.length > 0 ? (
        <section className="mt-10" aria-labelledby="no-results-best">
          <h2 id="no-results-best" className="m-0 mb-4 font-display text-[16px] font-semibold text-ink">{t('bestsellers')}</h2>
          <ProductGrid products={bestsellers} />
        </section>
      ) : null}
    </div>
  );
}
