import { useTranslations } from 'next-intl';
import ContentPage from '@/components/content/ContentPage';
import FallbackNotice from '@/components/content/FallbackNotice';
import JsonLd from '@/components/content/JsonLd';
import FaqAccordion, { type FaqTopicView } from '@/components/faq/FaqAccordion';
import ButtonLink from '@/components/ui/ButtonLink';
import { FAQ_TOPICS, allFaqIds, type FaqTopic } from '@/content/faq';
import { flattenBlocks, type ContentFigures } from '@/lib/content/blocks';
import { resolveLocalized } from '@/lib/content/localized';
import { contactHref } from '@/lib/routes';

export function buildFaqViews(topics: FaqTopic[], locale: string): { views: FaqTopicView[]; anyFallback: boolean } {
  let anyFallback = false;
  const views = topics.map((topic) => {
    const title = resolveLocalized(topic.title, locale);
    anyFallback ||= title.isFallback;
    return {
      id: topic.id,
      title: title.value,
      titleLang: title.isFallback ? 'en' : undefined,
      items: topic.items.map((item) => {
        const q = resolveLocalized(item.q, locale);
        const a = resolveLocalized(item.a, locale);
        const isFallback = q.isFallback || a.isFallback;
        anyFallback ||= isFallback;
        return { id: item.id, q: q.value, answer: a.value, lang: isFallback ? 'en' : undefined };
      }),
    };
  });
  return { views, anyFallback };
}

/** The `?q=` id is honoured only when it names a real question; anything else is ignored. */
export function validOpenId(q: string | undefined, topics: FaqTopic[] = FAQ_TOPICS): string | undefined {
  return q && allFaqIds(topics).includes(q) ? q : undefined;
}

export default function FaqView({
  locale,
  figures,
  openId,
  topics = FAQ_TOPICS,
}: {
  locale: string;
  figures: ContentFigures;
  openId?: string;
  topics?: FaqTopic[];
}) {
  const t = useTranslations('faq');
  const { views, anyFallback } = buildFaqViews(topics, locale);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: views.flatMap((topic) =>
      topic.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: flattenBlocks(item.answer, figures) },
      })),
    ),
  };
  return (
    <ContentPage
      title={t('title')}
      intro={t('intro')}
      banners={anyFallback ? <FallbackNotice locale={locale} /> : null}
    >
      <nav aria-label={t('topics')} className="mt-2 rounded-card border border-line bg-surface p-5">
        <p className="eyebrow m-0 mb-3">{t('topics')}</p>
        <ul className="m-0 list-none space-y-2 p-0 text-[14px]">
          {views.map((topic) => (
            <li key={topic.id}>
              <a href={`#topic-${topic.id}`} lang={topic.titleLang} className="underline underline-offset-2 hover:text-accent">
                {topic.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <FaqAccordion topics={views} figures={figures} openId={validOpenId(openId, topics)} locale={locale} />
      <section className="mt-12 rounded-panel bg-canvas-2 p-6">
        <h2 className="m-0 mb-3 font-display text-[20px] font-semibold">{t('stillNeedHelp')}</h2>
        <ButtonLink href={contactHref()} variant="ink">
          {t('contactLink')}
        </ButtonLink>
      </section>
      <JsonLd data={jsonLd} />
    </ContentPage>
  );
}
