import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ContentNotes } from '@/components/content/ContentNotes';
import { Markdown } from '@/components/content/Markdown';
import { StaticPage } from '@/components/content/StaticPage';
import { Link } from '@/i18n/routing';
import { POLICY_SLUGS, getPolicy } from '@/lib/content';
import { formatIsoDate } from '@/lib/format-date';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ version?: string | string[] }> };

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

const versionOf = (value: string | string[] | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  const policy = getPolicy(slug, locale, { version: versionOf(query.version) });
  if (!policy) return {};
  // A superseded version is a record, not the page to rank: it points at the current one.
  return pageMetadata({ locale, path: `/policies/${slug}`, title: policy.title, noindex: policy.superseded });
}

/** Policy at a stable address with the effective date of the text shown; `?version=<date>` shows a superseded version. */
export default async function PolicyPage({ params, searchParams }: Props) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const policy = getPolicy(slug, locale, { version: versionOf(query.version) });
  if (!policy) notFound();
  const t = await getTranslations('content');
  const earlier = policy.versions.filter((date) => date !== policy.currentEffective);

  return (
    <StaticPage title={policy.title}>
      <p className="m-0 font-meta font-bold text-navy-900">
        <time dateTime={policy.effective}>{t('effective', { date: formatIsoDate(policy.effective, locale) })}</time>
      </p>
      <ContentNotes draft={policy.draft} fellBack={policy.fellBack} />
      {policy.superseded ? (
        <p role="note" className="m-0 max-w-180 rounded-md bg-warning-50 p-4 text-warning-700">
          {t('supersededNotice', { date: formatIsoDate(policy.effective, locale) })}{' '}
          <Link href={`/policies/${slug}`} className="underline">
            {t('viewCurrent')}
          </Link>
        </p>
      ) : null}
      <Markdown source={policy.body} />
      {earlier.length > 0 ? (
        <nav aria-label={t('earlierVersions')}>
          <h2 className="font-display text-lg font-semibold text-navy-900">{t('earlierVersions')}</h2>
          <ul className="m-0 mt-2 grid list-none gap-1 p-0">
            {earlier.map((date) => (
              <li key={date}>
                <Link href={`/policies/${slug}?version=${date}`} className="text-text-link underline hover:text-brand-800">
                  {t('versionOption', { date: formatIsoDate(date, locale) })}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </StaticPage>
  );
}
