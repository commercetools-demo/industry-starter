import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentArticle } from '@/components/content/ContentArticle';
import { Link } from '@/i18n/routing';
import { getImageCredits } from '@/lib/content/credits';
import { dayBefore, formatDate } from '@/lib/content/format';
import { contentMetadata } from '@/lib/content/metadata';
import { LEGAL_SLUGS, getPolicy, legalPath } from '@/lib/content/policies';
import { LOCALES, isSupportedLocale } from '@/lib/utils';

type Props = {
  params: Promise<{ locale: string; policy: string }>;
  searchParams: Promise<{ asOf?: string | string[] }>;
};

// The version in force depends on today's date, so this page is never frozen at build time.
export const revalidate = 3600;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => LEGAL_SLUGS.map((policy) => ({ locale, policy })));
}

function asOfValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, policy } = await params;
  if (!isSupportedLocale(locale)) return {};
  const doc = getPolicy(policy, locale, { asOf: asOfValue((await searchParams).asOf) });
  if (!doc) return {};
  const metadata = contentMetadata({ title: doc.title, description: doc.description, locale, pathname: legalPath(doc.policy), fallback: doc.fallback });
  // An old version is for reference only: keep it out of search results.
  return doc.superseded ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function LegalPage({ params, searchParams }: Props) {
  const { locale, policy } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const doc = getPolicy(policy, locale, { asOf: asOfValue((await searchParams).asOf) });
  if (!doc) notFound();
  const t = await getTranslations({ locale, namespace: 'content' });
  const path = legalPath(doc.policy);
  const credits = doc.policy === 'image-credits' ? getImageCredits() : [];
  const showEarlier = doc.superseded || doc.earlier.length > 0;
  const dateLinks = [...(doc.superseded ? [doc.effective] : []), ...doc.earlier];

  return (
    <ContentArticle
      doc={{ title: doc.title, html: doc.html, fallback: doc.fallback }}
      intro={
        <div className="mt-4">
          <p className="m-0 font-body text-md text-text-muted">{t('legal.effective', { date: formatDate(doc.effective, locale) })}</p>
          {doc.superseded && doc.supersededOn ? (
            <p role="note" className="mt-5 mb-0 rounded-md bg-brand-100 px-5 py-4 font-body text-md text-text">
              {t('legal.superseded', { until: formatDate(dayBefore(doc.supersededOn), locale) })}{' '}
              <Link href={path} className="font-semibold text-text-link underline underline-offset-4">
                {t('legal.viewCurrent')}
              </Link>
            </p>
          ) : null}
        </div>
      }
    >
      {credits.length > 0 ? (
        <ul className="m-0 mt-5 flex list-none flex-col gap-1 p-0 font-body text-md">
          {credits.map((credit) => (
            <li key={credit.photographer}>
              <a href={credit.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-text-link underline underline-offset-4">
                {t('credits.photoBy', { name: credit.photographer })}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {showEarlier ? (
        <section aria-labelledby="earlier-versions" className="mt-9">
          <h2 id="earlier-versions" className="m-0 mb-3 font-display text-xl font-semibold text-brand-950">
            {t('legal.earlier')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {dateLinks.map((date) => (
              <li key={date}>
                <Link
                  href={{ pathname: path, query: { asOf: date } }}
                  className="inline-flex min-h-11 items-center text-text-link underline underline-offset-4"
                  aria-current={date === doc.effective && doc.superseded ? 'page' : undefined}
                >
                  {formatDate(date, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ContentArticle>
  );
}
