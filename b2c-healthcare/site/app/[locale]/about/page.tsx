import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ContentNotes } from '@/components/content/ContentNotes';
import { Markdown } from '@/components/content/Markdown';
import { StaticPage } from '@/components/content/StaticPage';
import { ButtonLink } from '@/components/ui/Button';
import { getAbout } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

// This page is assembled from content files only. It imports nothing from lib/ct or lib/session (a test
// enforces that), so it renders in full while the commerce tier is down.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const about = getAbout(locale);
  const t = await getTranslations('static.about');
  return pageMetadata({ locale, path: '/about', title: about?.title || t('title'), description: about?.description });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const about = getAbout(locale);
  if (!about) notFound();
  const t = await getTranslations('static.about');
  return (
    <StaticPage title={about.title || t('title')} sub={about.description}>
      <ContentNotes draft={about.draft} fellBack={about.fellBack} />
      <Markdown source={about.body} />
      <div>
        <ButtonLink href="/contact">{t('contactCta')}</ButtonLink>
      </div>
    </StaticPage>
  );
}
