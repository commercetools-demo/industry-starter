import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { TokenSwatches } from '@/components/dev/TokenSwatches';

// Development reference sheet of the design tokens. The folder is `%5Ftokens` because Next treats a
// folder that starts with `_` as private (not routable); the URL is `/<locale>/_tokens`.
// It does not exist in production builds (design-system-tokens: Not shipped).
export default async function TokensPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-content px-5 py-8 nav:px-8">
      <TokenSwatches />
    </div>
  );
}
