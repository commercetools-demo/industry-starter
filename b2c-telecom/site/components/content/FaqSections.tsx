import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRightIcon } from '@/components/ui/Icon';
import { FOCUS_RING } from '@/components/ui/focus';
import type { FaqTopic } from '@/lib/content/faq';
import { FaqAccordion } from './FaqAccordion';
import { PROSE } from './prose';

type FaqSectionsProps = {
  topics: FaqTopic[];
  /** Show the "Topics" navigation above the list (the full FAQ does, the support page does not). */
  showNav?: boolean;
  /** Wrap the list in the client enhancement that collapses answers after hydration. */
  collapsible?: boolean;
};

/**
 * Every answer is a native `<details open>` in the server HTML so it is readable and indexable without expanding;
 * never hide a closed answer with `hidden`, `display:none` or lazy loading.
 */
export function FaqSections({ topics, showNav = true, collapsible = true }: FaqSectionsProps): ReactElement {
  const t = useTranslations('content');
  const locale = useLocale();
  const list = (
    <>
      {topics.map((topic) => (
        <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-h`} className="mt-9 scroll-mt-7">
          <h2 id={`${topic.id}-h`} className="m-0 mb-4 font-display text-2xl font-bold text-brand-950">
            {topic.title}
          </h2>
          {topic.items.map((item) => (
            <details
              key={item.id}
              id={item.id}
              open
              lang={item.fallback && locale !== 'en-US' ? 'en' : undefined}
              className="group scroll-mt-7 border-b border-brand-200"
            >
              <summary
                className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-lg font-semibold text-brand-950 [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
              >
                <span>{item.question}</span>
                <ChevronRightIcon className="shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className={`pb-5 ${PROSE}`} dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
            </details>
          ))}
        </section>
      ))}
    </>
  );
  return (
    <div>
      {showNav ? (
        <nav aria-label={t('faq.topicsNav')} className="mt-7">
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {topics.map((topic) => (
              <li key={topic.id}>
                <a
                  href={`#${topic.id}`}
                  className={`inline-flex min-h-11 items-center rounded-pill bg-brand-100 px-5 font-display text-sm font-semibold text-brand-950 no-underline hover:bg-brand-200 ${FOCUS_RING}`}
                >
                  {topic.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {collapsible ? <FaqAccordion>{list}</FaqAccordion> : list}
    </div>
  );
}
