import 'server-only';
import type { ReactNode } from 'react';
import { PageBuilder, type SearchParamsInput } from '@commercetools-labs/page-builder';
import { components } from '@/components/page-builder/component-map';
import { pageBuilderMarket, pageBuilderPath } from '@/lib/page-builder/context';

export interface PageBuilderRouteProps {
  /** The URL locale. It alone decides the market of the call. */
  locale: string;
  /** The path segments after the locale (none for the home page). */
  segments?: readonly string[];
  /** The request's query string, forwarded untouched (preview flags, facets, sort, offset ride on it). */
  searchParams?: SearchParamsInput;
  /** The service has no page for this path. */
  fallback: ReactNode;
  /** The service is down, slow or misconfigured. Never a "not found": keep the shell and show something usable. */
  errorFallback: ReactNode;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

/**
 * The one place a route asks the page builder for a page. The shim classifies the outcome (ok, no page, failure) and logs the
 * reason of a failure; this wrapper fixes the market and path rules, which fallback each outcome gets, and the component map.
 * Rendering is dynamic and nothing is cached here: the service caches commercetools reads briefly.
 */
export async function PageBuilderRoute(props: PageBuilderRouteProps): Promise<ReactNode> {
  return PageBuilder({
    components,
    path: pageBuilderPath(props.segments),
    context: pageBuilderMarket(props.locale),
    ...(props.searchParams ? { searchParams: props.searchParams } : {}),
    fallback: props.fallback,
    errorFallback: props.errorFallback,
    ...(props.fetchImpl ? { fetch: props.fetchImpl } : {}),
  });
}
