// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useLocale, useTranslations } from 'next-intl';

/**
 * Header search seam for workstream L: a plain GET form to `/{locale}/{store}/search?q=` (works without JavaScript). L builds
 * the results page and may replace this component with suggestions; the form contract (`name="q"`) stays.
 */
export function SearchField({ store }: { store: string }) {
  const t = useTranslations('shell.search');
  const locale = useLocale();
  return (
    <form role="search" method="get" action={`/${locale}/${store}/search`} className="flex w-full">
      <label htmlFor="header-search" className="sr-only">
        {t('label')}
      </label>
      <input
        id="header-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder={t('placeholder')}
        className="min-h-7 min-w-0 flex-1 text-ellipsis rounded-l-xs border border-border-strong bg-surface px-3 font-ui text-sm text-text placeholder:text-text-subtle"
      />
      <button type="submit" className="min-h-7 shrink-0 rounded-r-xs bg-action px-5 font-display text-sm font-medium text-text-on-brand hover:bg-action-hover active:bg-action-active">
        {t('submit')}
      </button>
    </form>
  );
}
