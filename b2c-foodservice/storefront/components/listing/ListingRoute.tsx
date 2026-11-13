import ListingPage from '@/components/listing/ListingPage';
import { redirect } from '@/i18n/routing';
import type { BrandSlug } from '@/lib/brands';
import type { ListingResult } from '@/lib/listing/load';

/** Shared body of the three listing routes: redirects when the page is past the last one, otherwise renders. */
export default function ListingRoute({ result, locale, brand }: { result: ListingResult; locale: string; brand?: BrandSlug }) {
  if (result.kind === 'redirect') redirect({ href: result.href, locale, ...(brand ? { brand } : {}) });
  return <ListingPage result={result as Exclude<ListingResult, { kind: 'redirect' }>} />;
}
