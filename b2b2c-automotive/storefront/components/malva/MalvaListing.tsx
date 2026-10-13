// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Malva listing body (change add-malva-home): header with sort, brand filter, grid of `MalvaProductCard`, pagination, empty state.
// Server rendered. The reseller `ResultHeader` and `FilterPanel` read the store (garage bar, pickup filter, store home link), so
// this file composes the parts that need no store: `SortSelect`, `Pagination`, `GRID_CLASS` and the address helpers.
import { useTranslations } from 'next-intl';
import { GRID_CLASS } from '@/components/listing/ProductGrid';
import { Pagination } from '@/components/listing/Pagination';
import { SortSelect } from '@/components/listing/SortSelect';
import { MalvaProductCard } from '@/components/malva/MalvaProductCard';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { MalvaListingView } from '@/lib/listing/malva-load';
import { getFitState } from '@/lib/search/fitment';
import { effectiveSort, listingHref, removeFilter, type ListingParams } from '@/lib/search/params';
import type { MalvaProductSummary } from '@/lib/malva-types';

type OkView = Extract<MalvaListingView, { kind: 'ok' }>;

const CHIP = 'inline-flex min-h-7 items-center rounded-xs border px-3 font-ui text-sm';

/** Brand label of a facet bucket: the label the page's cards carry for that key, else the key itself. */
function brandLabels(items: MalvaProductSummary[], keys: string[]): Map<string, string> {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const byKey = new Map(items.filter((i) => i.brand).map((i) => [slug(i.brand), i.brand]));
  return new Map(keys.map((k) => [k, byKey.get(slug(k)) ?? k]));
}

/** Minimal brand filter: links, so it works without JavaScript; the brand lives in the address as in the reseller listing. */
export function MalvaBrandFilter({ params, basePath, buckets, items }: { params: ListingParams; basePath: string; buckets: { key: string; count: number }[]; items: MalvaProductSummary[] }) {
  const t = useTranslations('malvaFinder');
  if (buckets.length === 0 && params.brand.length === 0) return null;
  const keys = [...new Set([...params.brand, ...buckets.map((b) => b.key)])];
  const labels = brandLabels(items, keys);
  const toggle = (key: string): ListingParams =>
    params.brand.includes(key) ? removeFilter(params, 'brand', key) : { ...params, page: 1, brand: [...params.brand, key].sort() };
  return (
    <nav aria-label={t('brandFilter')} className="grid gap-2">
      <h2 className="m-0 font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('brandFilter')}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {keys.map((key) => {
          const selected = params.brand.includes(key);
          const count = buckets.find((b) => b.key === key)?.count;
          return (
            <li key={key}>
              <Link
                href={listingHref(basePath, toggle(key))}
                aria-current={selected ? 'true' : undefined}
                className={`${CHIP} ${selected ? 'border-border-brand bg-action-subtle text-action' : 'border-border-strong bg-surface text-text hover:bg-surface-subtle'}`}
              >
                {labels.get(key)}
                {count !== undefined ? <span className="ms-2 text-text-muted">({count})</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MalvaListing({ view, slug }: { view: OkView; slug: string }) {
  const t = useTranslations('malvaFinder');
  const { category, params, result } = view;
  const basePath = `/categories/${slug}`;
  const brandBuckets = result.facets.find((f) => f.name === 'brand')?.buckets ?? [];
  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 text-text min-[64rem]:p-5">
      <header className="grid gap-5">
        <nav aria-label={t('breadcrumb')} className="font-ui text-sm text-text-muted">
          <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            <li>
              <Link href="/" className="text-text-link hover:underline">
                {t('home')}
              </Link>
            </li>
            {category.ancestors.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span aria-hidden="true">›</span>
                <Link href={`/categories/${a.slug}`} className="text-text-link hover:underline">
                  {a.name}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              <span aria-current="page">{category.name}</span>
            </li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 font-display text-3xl font-semibold text-text">{category.name}</h1>
            <p className="m-0 font-ui text-sm text-text-muted">{t('count', { count: result.total })}</p>
          </div>
          <SortSelect value={effectiveSort(params)} hasQuery={false} />
        </div>
      </header>
      <MalvaBrandFilter params={params} basePath={basePath} buckets={brandBuckets} items={result.items} />
      <section aria-label={t('listingLabel')} className="min-w-0">
        {result.items.length > 0 ? (
          <>
            <ul aria-label={t('listingLabel')} className={`${GRID_CLASS} list-none p-0`}>
              {result.items.map((product) => (
                <li key={product.id} className="min-w-0">
                  <MalvaProductCard product={product} fit={getFitState(product, view.vehicle)} />
                </li>
              ))}
            </ul>
            <Pagination params={params} page={result.page} totalPages={result.totalPages} basePath={basePath} />
          </>
        ) : (
          <div className="grid justify-items-center gap-3 rounded-md border border-dashed border-border-strong bg-surface p-7 text-center">
            <h2 className="m-0 font-display text-lg font-semibold text-text">{t('emptyTitle')}</h2>
            <p className="m-0 font-ui text-sm text-text-muted">{t('emptyBody')}</p>
            {view.fitScopeOn && view.vehicleLabel ? (
              <>
                <p className="m-0 font-ui text-sm text-text-muted">{t('emptyFitBody', { vehicle: view.vehicleLabel })}</p>
                <Link href={listingHref(basePath, { ...params, fit: false, page: 1 })} className={buttonClass('secondary')}>
                  {t('emptyFitLink')}
                </Link>
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
