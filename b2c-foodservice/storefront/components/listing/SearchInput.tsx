'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { useRouter } from '@/i18n/routing';

/**
 * Pill search input above the results header. Submit navigates with `router.replace`, keeping the other parameters except
 * the page (`otherParams` is the serialized filter state without `q` and `page`). Autofocused on the first render of an
 * empty query and when nothing matched, so the shopper can edit straight away.
 */
export default function SearchInput({ initialQuery, otherParams, autoFocus }: { initialQuery: string; otherParams: string; autoFocus: boolean }) {
  const t = useTranslations('plp.search');
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialQuery);

  const go = (q: string) => {
    const params = new URLSearchParams(otherParams);
    const trimmed = q.trim();
    if (trimmed) params.set('q', trimmed);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search');
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };

  return (
    <form role="search" onSubmit={onSubmit} className="relative mb-6 max-w-[640px]">
      <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        ref={ref}
        type="search"
        name="q"
        value={value}
        maxLength={100}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('placeholder')}
        aria-label={t('label')}
        className="w-full rounded-pill border border-line-2 bg-surface py-3 pl-11 pr-12 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label={t('clear')}
          onClick={() => {
            setValue('');
            ref.current?.focus();
            go('');
          }}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill border-0 bg-transparent text-ink-2 hover:bg-ink/6"
        >
          <Icon name="x" size={16} />
        </button>
      ) : null}
    </form>
  );
}
