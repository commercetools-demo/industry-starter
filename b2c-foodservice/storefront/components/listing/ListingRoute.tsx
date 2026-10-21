import ListingPage from '@/components/listing/ListingPage';
import { redirect } from '@/i18n/routing';
import type { ListingResult } from '@/lib/listing/load';

/** Shared body of the three listing routes: redirects when the page is past the last one, otherwise renders. */
export default function ListingRoute({ result, locale }: { result: ListingResult; locale: string }) {
  if (result.kind === 'redirect') redirect({ href: result.href, locale });
  return <ListingPage result={result as Exclude<ListingResult, { kind: 'redirect' }>} />;
}
