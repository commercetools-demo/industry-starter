import { handle, jsonError } from '@/lib/api';
import { getCategoryByKey } from '@/lib/ct/categories';
import { loadCount, loadListing } from '@/lib/listing/load';
import { getMarket } from '@/lib/session';
import { isLocaleKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SCOPE = /^(shop|mcf-cat-[a-z0-9-]{1,64})$/;

/**
 * GET /api/search?scope=<shop|category key>&q=&sort=&page=&avail=1&f_<facet>=a,b&countOnly=1&locale=en-US
 * Same parameters as the listing URLs (parsed by `parseListingParams`, unknown values dropped). `locale` is the page's
 * market (default: the session's); the store comes from the session. Never cached.
 *  - countOnly=1 -> 200 { total } (a `limit: 0` search; the mobile filter sheet's live count)
 *  - otherwise   -> 200 { total, items: ProductSummary[], facets: FacetGroup[], page, pageCount }
 * Errors: 400 validation_failed (bad scope or locale), 404 not_found (unknown category), 422 validation_failed
 * (language not enabled on the project), 503 upstream_unavailable.
 */
export const GET = handle('/api/search', async (req) => {
  const url = new URL(req.url);
  const scopeParam = url.searchParams.get('scope') ?? 'shop';
  if (!SCOPE.test(scopeParam)) return jsonError('validation_failed', 400);
  const localeParam = url.searchParams.get('locale');
  if (localeParam !== null && !isLocaleKey(localeParam)) return jsonError('validation_failed', 400);
  const locale = localeParam ?? (await getMarket()).locale;
  const searchParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams) if (!(k in searchParams)) searchParams[k] = v;
  const headers = { 'Cache-Control': 'no-store' };

  if (url.searchParams.get('countOnly') === '1') {
    const out = await loadCount({ locale, scopeParam, searchParams });
    if ('total' in out) return Response.json({ total: out.total }, { headers });
    return out.status === 'unknown_scope' ? jsonError('not_found', 404) : jsonError('validation_failed', 422);
  }

  let slug: string | undefined;
  if (scopeParam !== 'shop') {
    const category = await getCategoryByKey(locale, scopeParam);
    if (!category) return jsonError('not_found', 404);
    slug = category.slug;
  }
  const result = await loadListing({ locale, scope: scopeParam === 'shop' ? (searchParams.q ? 'search' : 'shop') : 'category', slug, searchParams });
  if (result.kind === 'unsupported_language') return jsonError('validation_failed', 422);
  if (result.kind !== 'ok') return Response.json({ total: 0, items: [], facets: [], page: 1, pageCount: 1 }, { headers });
  return Response.json(
    { total: result.total, items: result.items, facets: result.groups, page: result.page, pageCount: result.pageCount },
    { headers },
  );
});
