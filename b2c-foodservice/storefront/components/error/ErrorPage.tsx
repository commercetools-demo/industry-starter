'use client';

import { useLocale, useTranslations } from 'next-intl';
import Button, { buttonClasses } from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import { Link, usePathname } from '@/i18n/routing';
import { buildListingHref } from '@/lib/nav/listing-href';
import { STATIC_TOP_CATEGORIES, accountHref, contactHref, searchHref, signInHref } from '@/lib/routes';

export type ErrorKind = 'not-found' | 'server-error' | 'forbidden' | 'unauthorized';

interface ErrorPageProps {
  kind: ErrorKind;
  /** Error digest, shown as "Reference {reference}" for server-error only. Never the error message. */
  reference?: string;
  /** server-error only: Next's retry or reset. */
  onRetry?: () => void;
}

const STATUS: Record<ErrorKind, string> = { 'not-found': '404', 'server-error': '500', forbidden: '403', unauthorized: '401' };
const KEYS: Record<ErrorKind, 'notFound' | 'server' | 'forbidden' | 'unauthorized'> = {
  'not-found': 'notFound',
  'server-error': 'server',
  forbidden: 'forbidden',
  unauthorized: 'unauthorized',
};

/**
 * The one error page for three conditions (and a sign-in prompt). Static: no session read, no commerce call,
 * no data fetching, so it renders even when the thing that failed was the commerce tier.
 */
export default function ErrorPage({ kind, reference, onRetry }: ErrorPageProps) {
  const t = useTranslations('error');
  const tNav = useTranslations('shell.nav');
  const locale = useLocale();
  const pathname = usePathname();
  const key = KEYS[kind];
  const text = kind === 'unauthorized' ? t('unauthorized.text') : t(`${key}.text`);

  return (
    <div className="wrap py-14 mobile:py-24">
      {/* React hoists this into the head: a page without a title is announced by its address (WCAG 2.4.2). */}
      <title>{t(`${key}.title`)}</title>
      <div className="max-w-[640px]">
        <p className="eyebrow m-0 mb-3">{STATUS[kind]}</p>
        <div role={kind === 'server-error' ? 'alert' : undefined}>
          <h1 className="page-title m-0">{t(`${key}.title`)}</h1>
          <p className="mt-4 text-[17px] text-ink-2">{text}</p>
        </div>

        {kind === 'server-error' && reference ? <p className="m-0 mt-3 font-mono text-[13px] text-ink-2">{t('reference', { reference })}</p> : null}

        {kind === 'not-found' ? (
          <>
            <form role="search" method="get" action={`/${locale}${searchHref()}`} className="mt-8 flex gap-2">
              <label htmlFor="error-search" className="sr-only">
                {t('searchLabel')}
              </label>
              <input
                id="error-search"
                name="q"
                type="search"
                placeholder={t('searchLabel')}
                className="min-h-11 w-full rounded-pill border border-line-2 bg-surface px-4 text-[14px] outline-none focus:border-accent focus:ring-3 focus:ring-ring"
              />
              <button type="submit" className={`${buttonClasses({ variant: 'ink' })} cursor-pointer`}>
                {t('searchSubmit')}
              </button>
            </form>
            <nav aria-label={t('browse')} className="mt-8">
              <p className="eyebrow m-0 mb-3">{t('browse')}</p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {STATIC_TOP_CATEGORIES.map((slug) => (
                  <li key={slug}>
                    <Link
                      href={buildListingHref(slug)}
                      className="transition-state inline-flex min-h-9 items-center rounded-pill border border-line-2 bg-surface px-4 py-[7px] text-[13px] font-medium text-ink hover:border-ink"
                    >
                      {tNav(slug)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {kind === 'server-error' && onRetry ? (
            <Button variant="ink" onClick={onRetry}>
              {t('retry')}
            </Button>
          ) : null}
          {kind === 'forbidden' ? (
            <ButtonLink href={accountHref()} variant="ink">
              {t('account')}
            </ButtonLink>
          ) : null}
          {kind === 'unauthorized' ? (
            <ButtonLink href={signInHref(pathname)} variant="ink">
              {t('signIn')}
            </ButtonLink>
          ) : null}
          {kind !== 'unauthorized' ? (
            <ButtonLink href="/" variant={kind === 'not-found' ? 'ink' : 'ghost'}>
              {t('home')}
            </ButtonLink>
          ) : null}
          {kind === 'server-error' || kind === 'forbidden' ? (
            <ButtonLink href={contactHref()} variant="ghost">
              {t('contact')}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
