import 'server-only';
import type { ProductSearchRequest } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { getProjectLanguages } from '@/lib/ct/project';
import {
  PAGE_SIZE, buildSearchRequest,
  type RawFacet, type SearchContext, type SearchScope,
} from '@/lib/search/build';
import type { ListingParams } from '@/lib/search/params';

export type SearchOutcome =
  | {
      status: 'ok';
      total: number;
      /** Product ids in search order. */
      ids: string[];
      /** product id to the SKU the query matched (only when the query is a SKU). */
      matchedSkus: Record<string, string>;
      facets: RawFacet[];
      page: number;
      pageCount: number;
      /** Set when the requested page is past the last one; the caller redirects to this page. */
      redirectToPage?: number;
    }
  | { status: 'unsupported_language' };

interface RawResult { id: string; matchingVariants?: { allMatched?: boolean; matchedVariants?: { id: number; sku?: string }[] } }
interface RawResponse { total: number; results: RawResult[]; facets?: RawFacet[] }

async function run(body: ReturnType<typeof buildSearchRequest>): Promise<RawResponse> {
  const res = await apiRoot.products().search().post({ body: body as unknown as ProductSearchRequest }).execute();
  return res.body as unknown as RawResponse;
}

/** True when the project has this display language (case-insensitive). */
export async function isLanguageSupported(locale: string): Promise<boolean> {
  const languages = await getProjectLanguages();
  return languages.some((l) => l.toLowerCase() === locale.toLowerCase());
}

function matchedSkusOf(results: RawResult[], q?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!q) return out;
  for (const r of results) {
    const hit = r.matchingVariants?.matchedVariants?.find((v) => v.sku?.toLowerCase() === q.toLowerCase());
    if (hit?.sku) out[r.id] = hit.sku;
  }
  return out;
}

/**
 * Product Search (never productProjections search, D-023): returns ids only, in search order. The caller reads the
 * projections with `getListingProjections`. `limit: 0` gives a count (the mobile sheet). A page past the last result is
 * re-run once at the last page and reported through `redirectToPage`.
 */
export async function searchProducts(
  ctx: SearchContext,
  scope: SearchScope,
  params: ListingParams,
  opts: { limit?: number; withFacets?: boolean } = {},
): Promise<SearchOutcome> {
  if (!(await isLanguageSupported(ctx.locale))) return { status: 'unsupported_language' };
  const limit = opts.limit ?? PAGE_SIZE;
  const withFacets = opts.withFacets ?? true;
  const offset = limit > 0 ? (params.page - 1) * limit : 0;
  let res = await run(buildSearchRequest(ctx, scope, params, { limit, offset, withFacets }));
  let page = params.page;
  let redirectToPage: number | undefined;
  if (limit > 0 && res.results.length === 0 && res.total > 0) {
    page = Math.floor((res.total - 1) / limit) + 1;
    redirectToPage = page;
    res = await run(buildSearchRequest(ctx, scope, params, { limit, offset: (page - 1) * limit, withFacets }));
  }
  return {
    status: 'ok',
    total: res.total,
    ids: res.results.map((r) => r.id),
    matchedSkus: matchedSkusOf(res.results, params.q),
    facets: res.facets ?? [],
    page,
    pageCount: limit > 0 ? Math.max(1, Math.ceil(res.total / limit)) : 1,
    ...(redirectToPage ? { redirectToPage } : {}),
  };
}
