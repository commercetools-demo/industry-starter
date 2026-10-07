import { ApiError } from '@/lib/api-error';
import { isLocale } from '@/lib/config/markets';
import { errorResponse, json } from '@/lib/ct/http';
import { loadSearch } from '@/lib/search/load';
import type { Locale } from '@/lib/types';

// GET /api/search?q=&category=&sort=&page=[&locale=en-US]: the same data as the search page, as JSON (tests and index polling).
// An empty result is HTTP 200 (`state: "none"`); only an upstream failure answers 502 (`UPSTREAM_ERROR`).

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const requested = search.get('locale');
    const locale: Locale = requested !== null && isLocale(requested) ? requested : 'en-US';
    const { params, view } = await loadSearch(locale, Object.fromEntries(search));
    if (view.state === 'error') throw new ApiError('UPSTREAM_ERROR', 'Search is temporarily unavailable');
    return json({
      query: view.query,
      state: view.state,
      total: view.total,
      truncated: view.truncated,
      page: view.page,
      pageCount: view.pageCount,
      category: params.category,
      categories: view.categories,
      results: view.items,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
