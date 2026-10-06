import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/Container';
import { getLastResetLink, isDevStubEnabled } from '@/lib/dev-stub';

export const dynamic = 'force-dynamic';

/** Development stub for the reset email (D-038). A 404 in every other environment. Dev copy is intentionally English-only. */
export default async function DevResetLinkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isDevStubEnabled()) notFound();
  const last = getLastResetLink();
  return (
    <Container className="py-12">
      <h1>Dev only: last password reset link</h1>
      {last ? (
        <p>
          For {last.email}: <a href={last.url}>{last.url}</a>
        </p>
      ) : (
        <p>No reset link has been created since the dev server started.</p>
      )}
    </Container>
  );
}
