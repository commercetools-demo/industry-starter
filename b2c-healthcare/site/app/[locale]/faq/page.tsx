import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentNotes } from '@/components/content/ContentNotes';
import { Markdown } from '@/components/content/Markdown';
import { StaticPage } from '@/components/content/StaticPage';
import { Card } from '@/components/ui/Card';
import { getFaqGroups } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('static.faq');
  return pageMetadata({ locale, path: '/faq', title: t('title'), description: t('sub') });
}

/**
 * Every answer is plain text in the initial HTML (no accordion that fetches or hides it), so it is
 * readable and indexable without JavaScript. `/faq#<id>` scrolls to a question, which `:target` highlights.
 * The "Was this helpful?" collector is intentionally absent in v1 (nothing to be unreachable).
 */
export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('static.faq');
  const groups = getFaqGroups(locale);
  const anyDraft = groups.some((group) => group.items.some((item) => item.draft));
  const anyFallback = groups.some((group) => group.items.some((item) => item.fellBack));

  return (
    <StaticPage title={t('title')} sub={t('sub')}>
      <ContentNotes draft={anyDraft} fellBack={anyFallback} />
      {groups.length === 0 ? <p className="m-0 text-neutral-600">{t('empty')}</p> : null}
      {groups.length > 1 ? (
        <nav aria-label={t('topicsNav')}>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {groups.map((group) => (
              <li key={group.topic}>
                <a href={`#topic-${group.topic}`} className="font-display font-medium text-text-link hover:text-brand-800">
                  {t(`topics.${group.topic}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {groups.map((group) => (
        <section key={group.topic} aria-labelledby={`topic-${group.topic}`} className="grid gap-4">
          <h2 id={`topic-${group.topic}`} className="scroll-mt-24 font-display text-2xl font-semibold text-navy-900">
            {t(`topics.${group.topic}`)}
          </h2>
          {group.items.map((item) => (
            <Card as="article" key={item.id} id={item.id} className="scroll-mt-24 border-thick border-transparent target:border-brand-300">
              <h3 className="m-0 mb-2 font-display text-lg font-medium text-navy-900">
                <a href={`#${item.id}`} className="text-navy-900 hover:text-brand-800">
                  {item.question}
                </a>
              </h3>
              <Markdown source={item.body} idPrefix={`${item.id}-`} />
            </Card>
          ))}
        </section>
      ))}
    </StaticPage>
  );
}
