import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';

export interface TocEntry {
  id: string;
  text: string;
}

interface ContentPageProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  /** Table of contents entries (h2 ids); shown when more than three. */
  toc?: TocEntry[];
  /** Language of the prose region when it differs from the page ("en" for fallback text). */
  contentLang?: string;
  /** Rendered between the heading and the prose: notices, effective date. */
  banners?: ReactNode;
  children: ReactNode;
}

/** Breadcrumb, one h1, intro and a prose column of at most 68ch. Pages never render their own `<main>`. */
export default function ContentPage({ title, eyebrow, intro, toc, contentLang, banners, children }: ContentPageProps) {
  const t = useTranslations('content');
  return (
    <div className="wrap py-10 mobile:py-14">
      <nav aria-label={t('breadcrumb')} className="mb-6 text-[13px] text-ink-2">
        <ol className="m-0 flex list-none items-center gap-2 p-0">
          <li>
            <Link href="/" className="underline underline-offset-2 hover:text-accent">
              {t('home')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <header className="max-w-[68ch]">
        {eyebrow ? <p className="eyebrow m-0 mb-3">{eyebrow}</p> : null}
        <h1 className="page-title m-0">{title}</h1>
        {intro ? <p className="mt-4 text-[17px] text-ink-2">{intro}</p> : null}
      </header>
      <div className="mt-6 max-w-[68ch]">{banners}</div>
      <div lang={contentLang} className="max-w-[68ch]">
        {toc && toc.length > 3 ? (
          <nav aria-label={t('toc')} className="mb-8 rounded-card border border-line bg-surface p-5">
            <p className="eyebrow m-0 mb-3">{t('toc')}</p>
            <ul className="m-0 list-none space-y-2 p-0 text-[14px]">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a href={`#${entry.id}`} className="underline underline-offset-2 hover:text-accent">
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {children}
      </div>
    </div>
  );
}
