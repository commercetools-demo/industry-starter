'use client';

import { useEffect } from 'react';
import Blocks from '@/components/content/Blocks';
import FaqFeedback from '@/components/faq/FaqFeedback';
import type { Block, ContentFigures } from '@/lib/content/blocks';

export interface FaqTopicView {
  id: string;
  title: string;
  titleLang?: string;
  items: Array<{ id: string; q: string; answer: Block[]; lang?: string }>;
}

const PREFIX = 'question-';

function openFromHash(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id.startsWith(PREFIX)) return;
  const el = document.getElementById(id);
  if (!(el instanceof HTMLDetailsElement)) return;
  el.open = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  el.querySelector('summary')?.focus({ preventScroll: true });
}

/**
 * Topics as sections with one native `details` per question. Every answer is in the HTML of the first response (closed
 * details are still crawlable and reachable by a screen reader). `openId` opens one answer on the server (`?q=<id>`);
 * `#question-<id>` is handled on load and on hashchange.
 */
export default function FaqAccordion({
  topics,
  figures,
  openId,
  locale,
}: {
  topics: FaqTopicView[];
  figures: ContentFigures;
  openId?: string;
  locale: string;
}) {
  useEffect(() => {
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  return (
    <div>
      {topics.map((topic) => (
        <section key={topic.id} id={`topic-${topic.id}`} aria-labelledby={`heading-${topic.id}`} className="mt-10 scroll-mt-28">
          <h2 id={`heading-${topic.id}`} lang={topic.titleLang} className="m-0 mb-4 font-display text-[24px] font-bold">
            {topic.title}
          </h2>
          <div className="divide-y divide-line rounded-card border border-line bg-surface">
            {topic.items.map((item) => (
                <details key={item.id} id={`${PREFIX}${item.id}`} open={item.id === openId} className="group scroll-mt-28 px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                    <h3 lang={item.lang} className="m-0 text-[16px] font-semibold">
                      {item.q}
                    </h3>
                    <span aria-hidden="true" className="text-[20px] text-ink-2 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div lang={item.lang} className="pb-5">
                    <Blocks blocks={item.answer} figures={figures} />
                  </div>
                  <FaqFeedback questionId={item.id} locale={locale} />
                </details>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
