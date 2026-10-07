import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchForm } from './SearchForm';

/** The honey strip on top of the search page, like the listing's: breadcrumb "Home / Search", H1 and the search field. */
export function SearchTitleStrip({ q }: { q: string }): ReactElement {
  const t = useTranslations('search');
  const tp = useTranslations('plp');
  return (
    <section className="bg-brand-100 py-10 md:py-12">
      <div className="mx-auto flex w-full max-w-(--container-width) flex-col gap-5 px-5 md:px-10">
        <Breadcrumb items={[{ label: tp('home'), href: '/' }, { label: t('title') }]} />
        <h1 className="m-0 font-display text-5xl font-bold tracking-ui">{t('title')}</h1>
        <SearchForm q={q} />
      </div>
    </section>
  );
}
