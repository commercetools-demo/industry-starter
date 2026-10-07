import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import type { NavItem } from '@/lib/nav';

export type ErrorKind = 'not-found' | 'unauthorized' | 'server';

type ErrorViewProps = {
  kind: ErrorKind;
  /** Short reference the buyer can quote to support (Next's `error.digest`, or the `ref` of the unauthorized URL). */
  reference?: string;
  /** Server error only: re-renders the segment. */
  onRetry?: () => void;
  /** Not found only: root categories for recovery links (omitted when the catalog is unavailable). */
  categories?: NavItem[];
};

const KICKER = { 'not-found': 'notFound', unauthorized: 'unauthorized', server: 'server' } as const;

/** One recovery page, three kinds. Never prints an error message: only a title, plain advice and an optional reference. */
export function ErrorView({ kind, reference, onRetry, categories = [] }: ErrorViewProps): ReactElement {
  const t = useTranslations('errors');
  const locale = useLocale();
  const key = KICKER[kind];
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-5 py-10 md:px-10">
      <Tag tone="brand" className="self-start">
        {t(`kicker.${key}`)}
      </Tag>
      <h1 className="m-0 font-display text-4xl font-bold">{t(`${key}.title`)}</h1>
      <p className="m-0 font-body text-lg text-text-muted">{t(`${key}.body`)}</p>

      {kind === 'not-found' ? (
        <>
          <form role="search" action={`/${locale}/search`} method="get" className="flex flex-col gap-5">
            <Field label={t('notFound.searchLabel')}>
              <Input type="search" name="q" autoComplete="off" />
            </Field>
            <Button type="submit" className="self-start">
              {t('notFound.searchButton')}
            </Button>
          </form>
          {categories.length > 0 ? (
            <nav aria-label={t('notFound.browse')} className="flex flex-col gap-3">
              <p className="m-0 font-display text-sm font-semibold tracking-ui">{t('notFound.browse')}</p>
              <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
                {categories.map((item) => (
                  <li key={item.key}>
                    <Button href={item.path} variant="secondary" size="sm">
                      {item.label}
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div>
            <Button href="/" variant="secondary">
              {t('home')}
            </Button>
          </div>
        </>
      ) : null}

      {kind === 'server' ? (
        <>
          {reference ? <p className="m-0 font-body text-sm text-text-muted">{t('reference', { reference })}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRetry}>{t('server.retry')}</Button>
            <Button href="/" variant="secondary">
              {t('home')}
            </Button>
          </div>
        </>
      ) : null}

      {kind === 'unauthorized' ? (
        <>
          {reference ? <p className="m-0 font-body text-sm text-text-muted">{t('reference', { reference })}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button href="/account">{t('unauthorized.account')}</Button>
            <Button href="/support" variant="secondary">
              {t('unauthorized.support')}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
