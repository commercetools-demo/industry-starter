import type { ReactElement, ReactNode } from 'react';
import type { PageDoc } from '@/lib/content/pages';
import { FallbackNotice } from './FallbackNotice';
import { KICKER, PAGE_COLUMN, PAGE_FRAME, PAGE_TITLE, PROSE } from './prose';

type ContentArticleProps = {
  doc: Pick<PageDoc, 'title' | 'kicker' | 'html' | 'fallback'>;
  /** Rendered between the H1 and the body (effective date, notices). */
  intro?: ReactNode;
  /** Rendered after the markdown body (contact card, FAQ list, ...). */
  children?: ReactNode;
};

/** One content page: optional fallback notice, kicker, H1, the rendered markdown body, then extra blocks. */
export function ContentArticle({ doc, intro, children }: ContentArticleProps): ReactElement {
  return (
    <div className={PAGE_FRAME}>
      <div className={PAGE_COLUMN}>
        {doc.fallback ? <FallbackNotice /> : null}
        {/* English text under a German URL is marked lang="en" so screen readers switch voice. */}
        <article lang={doc.fallback ? 'en' : undefined}>
          {doc.kicker ? <p className={`m-0 ${KICKER}`}>{doc.kicker}</p> : null}
          <h1 className={`m-0 ${PAGE_TITLE}`}>{doc.title}</h1>
          {intro}
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: doc.html }} />
          {children}
        </article>
      </div>
    </div>
  );
}
