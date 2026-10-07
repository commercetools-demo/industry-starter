import { buildListing } from '@/lib/catalog/listing';
import { isLocale, marketFromLocale } from '@/lib/config/markets';
import { getOfferByKey, getOffersInCategory } from '@/lib/ct/catalog';
import { getCategoryByKey, getCategoryTree } from '@/lib/ct/categories';
import { errorResponse, json } from '@/lib/ct/http';
import { searchOffers } from '@/lib/ct/search';
import { formatMoney } from '@/lib/format';
import type { Category, Locale, Offer, SearchSort } from '@/lib/types';

// Development-only JSON window onto the catalog reads, for Chrome checks. Not part of the product: the `.dev.ts` suffix keeps
// the route out of production builds (check:dev-routes) and the first line of the handler refuses anything but `next dev`.

const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, { status });

function reduce(offer: Offer, locale: Locale) {
  const label = offer.headline.recurring ?? offer.headline.oneTime;
  return {
    key: offer.key,
    name: offer.name,
    kind: offer.kind,
    primaryCategoryKey: offer.primaryCategoryKey,
    headline: {
      recurring: offer.headline.recurring,
      oneTime: offer.headline.oneTime,
      termMonths: offer.headline.termMonths,
      label: label ? formatMoney(label, locale) : null,
    },
    variantTerms: offer.variants.map((variant) => variant.termMonths),
    factsKind: offer.facts?.kind ?? null,
  };
}

const reduceTree = (tree: Category[]): unknown[] =>
  tree.map((category) => ({ key: category.key, slug: category.slug, name: category.name, children: reduceTree(category.children) }));

const SORTS = ['price-asc', 'price-desc', 'name'] as const;
const SEARCH_SORTS: readonly SearchSort[] = ['relevance', 'price-asc', 'price-desc'];

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  try {
    const params = new URL(request.url).searchParams;
    const localeParam = params.get('locale') ?? 'en-US';
    if (!isLocale(localeParam)) return fail(400, 'UNSUPPORTED_LOCALE', `Unsupported locale: ${localeParam}`);
    const locale = localeParam;
    const market = marketFromLocale(locale);
    const view = params.get('view') ?? 'categories';
    const page = Number(params.get('page') ?? '1') || 1;

    if (view === 'categories') return json({ categories: reduceTree(await getCategoryTree(locale)) });

    if (view === 'offer') {
      const offer = await getOfferByKey(params.get('key') ?? '', market);
      return json({ offer: offer ? reduce(offer, locale) : null });
    }

    if (view === 'offers') {
      const categoryKey = params.get('category') ?? '';
      if (!(await getCategoryByKey(categoryKey, locale))) return fail(404, 'CATEGORY_NOT_FOUND', `Unknown category: ${categoryKey}`);
      const sort = SORTS.find((candidate) => candidate === params.get('sort'));
      const offers = await getOffersInCategory(categoryKey, market);
      const listing = buildListing(
        offers,
        categoryKey,
        { chip: params.get('chip') ?? undefined, band: params.get('band') ?? undefined, sort, page },
        await getCategoryTree(locale),
      );
      return json({ ...listing, offers: listing.offers.map((offer) => reduce(offer, locale)) });
    }

    if (view === 'search') {
      const sort = SEARCH_SORTS.find((candidate) => candidate === params.get('sort'));
      const result = await searchOffers({
        locale,
        currency: market.currency,
        country: market.country,
        text: params.get('q') ?? undefined,
        categoryKey: params.get('category') ?? undefined,
        band: params.get('band') ?? undefined,
        sort,
        page,
      });
      return json({ ...result, offers: result.offers.map((offer) => reduce(offer, locale)) });
    }

    return fail(400, 'UNSUPPORTED_VIEW', `Unsupported view: ${view}`);
  } catch (err) {
    return errorResponse(err);
  }
}
