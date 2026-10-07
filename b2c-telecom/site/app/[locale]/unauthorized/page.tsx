import { setRequestLocale } from 'next-intl/server';
import { ErrorView } from '@/components/errors/ErrorView';
import { isSafeReference } from '@/lib/auth/next-url';

export const metadata = { robots: { index: false } };

// HTTP 200: a route page cannot set 403 without the experimental forbidden() API, which is not enabled.
export default async function UnauthorizedPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ref?: string | string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ref } = await searchParams;
  const value = Array.isArray(ref) ? ref[0] : ref;
  return <ErrorView kind="unauthorized" reference={isSafeReference(value) ? value : undefined} />;
}
