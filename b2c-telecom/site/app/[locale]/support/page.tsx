import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactCard } from '@/components/content/ContactCard';
import { ContentArticle } from '@/components/content/ContentArticle';
import { FaqSections } from '@/components/content/FaqSections';
import { Link } from '@/i18n/routing';
import { getFaq } from '@/lib/content/faq';
import { contentMetadata } from '@/lib/content/metadata';
import { getPage } from '@/lib/content/pages';
import { LOCALES, isSupportedLocale } from '@/lib/utils';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const doc = getPage('support', locale);
  if (!doc) return {};
  return contentMetadata({ title: doc.title, description: doc.description, locale, pathname: '/support', fallback: doc.fallback });
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const doc = getPage('support', locale);
  if (!doc) notFound();
  const t = await getTranslations({ locale, namespace: 'content' });
  // One question per topic, rendered open so the answers are in the HTML.
  const popular = (getFaq(locale)?.topics ?? []).map((topic) => ({ ...topic, items: topic.items.slice(0, 1) }));

  return (
    <ContentArticle doc={doc}>
      <ContactCard />
      {popular.length > 0 ? (
        <section aria-labelledby="popular-questions" className="mt-9">
          <h2 id="popular-questions" className="m-0 font-display text-2xl font-bold text-brand-950">
            {t('support.popular')}
          </h2>
          <FaqSections topics={popular} showNav={false} collapsible={false} />
          <p className="mt-7">
            <Link href="/faq" className="inline-flex min-h-11 items-center font-display text-md font-semibold text-text-link underline underline-offset-4">
              {t('faq.allQuestions')}
            </Link>
          </p>
        </section>
      ) : null}
    </ContentArticle>
  );
}
