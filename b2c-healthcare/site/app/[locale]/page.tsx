import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHead } from '@/components/ui/PageHead';
import { Link } from '@/i18n/routing';
import { tryProjectKey } from '@/lib/ct/health';

// Smoke page (storefront-project-bootstrap: Bootstrap smoke test). It proves routing, messages, tokens
// and, in development, the commercetools connection. Workstream M replaces it with the home page.
export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ui] = await Promise.all([getTranslations('shell'), getTranslations('ui')]);
  // Development only: production builds never call commercetools from this page.
  const isDevelopment = process.env.NODE_ENV === 'development';
  const projectKey = isDevelopment ? await tryProjectKey() : undefined;

  return (
    <>
      <PageHead title={t('smoke.title')} sub={t('smoke.lead')} />
      <div className="mx-auto max-w-content px-5 py-8 nav:px-8">
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/doctors/remote">{t('nav.remote')}</ButtonLink>
            <Badge variant="ok">{ui('status.available')}</Badge>
          </div>
          {projectKey === undefined ? null : (
            <p data-project-key className="font-meta text-sm text-neutral-600">
              {projectKey === null ? t('smoke.projectUnavailable') : t('smoke.projectKey', { key: projectKey })}
            </p>
          )}
          {isDevelopment ? (
            <Link href="/_tokens" className="text-sm text-text-link hover:text-brand-800">
              {t('smoke.tokenSheet')}
            </Link>
          ) : null}
        </Card>
      </div>
    </>
  );
}
