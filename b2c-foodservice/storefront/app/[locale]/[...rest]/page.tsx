import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import ErrorPage from '@/components/error/ErrorPage';
import { renderPage } from '@/components/page-builder/renderPage';
import { isReservedPath } from '@/lib/page-builder/reserved';

type Props = {
  params: Promise<{ locale: string; rest: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Pages authored in the page builder (landing and editorial pages). Unmatched paths under a valid locale render the localized 404
 * with the shell (known next-intl pattern); a path the service has no page for is that same 404. If the service is down the
 * shopper gets the degraded page, never a "not found" for a page that may exist. Native routes are resolved by Next before this
 * route, and a reserved first segment is refused here without a render call.
 */
export default async function CatchAllPage({ params, searchParams }: Props) {
  const { locale, rest } = await params;
  setRequestLocale(locale);
  if (isReservedPath(rest)) notFound();
  const outcome = await renderPage({ locale, segments: rest, ...(searchParams ? { searchParams: await searchParams } : {}) });
  if (outcome.kind === 'page') return <div>{outcome.node}</div>;
  if (outcome.kind === 'failed') return <ErrorPage kind="server-error" />;
  notFound();
}
