import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ContentNotes } from '@/components/content/ContentNotes';
import { Markdown } from '@/components/content/Markdown';
import { StaticPage } from '@/components/content/StaticPage';
import { Card } from '@/components/ui/Card';
import { getContact } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('static.contact');
  return pageMetadata({ locale, path: '/contact', title: t('title'), description: t('sub') });
}

/**
 * Contact details as plain text (Q-072): no enquiry form and no chat script, so there is nothing that can
 * fail silently or be blocked by consent. A region without an office shows the general block only.
 */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { general, offices } = getContact(locale);
  if (!general) notFound();
  const [t, content] = await Promise.all([getTranslations('static.contact'), getTranslations('content')]);
  const draft = general.draft || offices.some((office) => office.draft);
  const fellBack = general.fellBack || offices.some((office) => office.fellBack);

  return (
    <StaticPage title={general.title || t('title')} sub={t('sub')}>
      <ContentNotes draft={draft} fellBack={fellBack} />
      <Card as="section" aria-labelledby="contact-general">
        <h2 id="contact-general" className="sr-only">
          {general.title}
        </h2>
        <Markdown source={general.body} idPrefix="general-" />
      </Card>
      {offices.length > 0 ? (
        <section aria-labelledby="contact-offices" className="grid gap-4">
          <h2 id="contact-offices" className="font-display text-2xl font-semibold text-navy-900">
            {t('offices')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {offices.map((office) => (
              <Card as="article" key={office.title}>
                <h3 className="m-0 mb-2 font-display text-lg font-medium text-navy-900">{office.title}</h3>
                <Markdown source={office.body} />
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      <Card as="aside" aria-labelledby="contact-emergency" className="bg-danger-50">
        <h2 id="contact-emergency" className="m-0 mb-1 font-display text-lg font-semibold text-danger-700">
          {t('emergencyTitle')}
        </h2>
        <p className="m-0 text-danger-700">{content('emergency')}</p>
      </Card>
    </StaticPage>
  );
}
